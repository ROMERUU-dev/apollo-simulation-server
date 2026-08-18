import pytest
from conftest import AUDIENCE, FakeJwksFetcher, KeyMaterial, auth_headers, make_client, make_token
from pydantic import ValidationError

from cimasim_api.config import Settings
from cimasim_api.jobs.models import (
    CUSTOM_TEMPLATE_ID,
    SKY130_TEMPLATE_ID,
    JobCreateRequest,
    StoredJobRequest,
)
from cimasim_api.sky130.template import (
    PDK_CONTAINER_ROOT,
    Sky130FloatingBulkParameters,
    build_netlist,
)


def make(**overrides: object) -> JobCreateRequest:
    return JobCreateRequest(
        name="Oscilador",
        template_id=SKY130_TEMPLATE_ID,
        sky130_parameters=Sky130FloatingBulkParameters(**overrides),  # type: ignore[arg-type]
    )


def test_request_builds_the_netlist_server_side() -> None:
    request = make()
    assert request.netlist is not None
    assert request.requested_outputs == ["V(vout)", "V(vb)", "V(vg)"]
    assert request.temperature_celsius == 27.0
    assert f'.lib "{PDK_CONTAINER_ROOT}/libs.tech/ngspice/sky130.lib.spice" tt' in request.netlist
    assert "sky130_fd_pr__nfet_g5v0d10v5" in request.netlist


def test_user_cannot_supply_a_netlist_or_outputs_for_this_template() -> None:
    for payload in (
        {"netlist": ".lib /etc/passwd tt\n.END\n"},
        {"requested_outputs": ["V(x)"]},
        {"temperature_celsius": 40.0},
        {"parameters": {"resistance_ohm": 1.0, "capacitance_farad": 1.0}},
    ):
        with pytest.raises(ValidationError):
            JobCreateRequest.model_validate(
                {
                    "name": "Oscilador",
                    "template_id": SKY130_TEMPLATE_ID,
                    "sky130_parameters": {},
                    **payload,
                }
            )


def test_sky130_parameters_rejected_on_other_templates() -> None:
    with pytest.raises(ValidationError):
        JobCreateRequest.model_validate(
            {
                "name": "Custom",
                "template_id": CUSTOM_TEMPLATE_ID,
                "netlist": "R1 a 0 1k\n.TRAN 1u 1m\n.END\n",
                "requested_outputs": ["V(a)"],
                "sky130_parameters": {},
            }
        )


def test_template_requires_parameters() -> None:
    with pytest.raises(ValidationError):
        JobCreateRequest.model_validate({"name": "Oscilador", "template_id": SKY130_TEMPLATE_ID})


@pytest.mark.parametrize(
    "override",
    [
        {"device": "sky130_fd_pr__nfet_01v8"},
        {"corner": "ss"},
        {"corner": "../../etc"},
        {"l_um": 0.0},
        {"l_um": 1e9},
        {"w_um": "1"},
        {"nf": 0},
        {"nf": 1.5},
        {"iin_a": 1.0},
        {"rgate_ohm": 0.0},
        {"temperature_celsius": 1000.0},
        {"tstop_seconds": 100.0},
        {"cbulk_f": -1e-15},
    ],
)
def test_parameter_validation_rejects_unphysical_or_wrong_typed_values(override: dict) -> None:
    with pytest.raises(ValidationError):
        Sky130FloatingBulkParameters(**override)


def test_parameters_reject_unknown_fields_and_spice_payloads() -> None:
    for payload in ({"netlist": "x"}, {"include": "/etc/passwd"}, {"lib": "@sky130"}):
        with pytest.raises(ValidationError):
            Sky130FloatingBulkParameters(**payload)


def test_output_interval_cannot_exceed_tstop() -> None:
    params = Sky130FloatingBulkParameters(tstop_seconds=1e-7, output_interval_seconds=1e-6)
    with pytest.raises(ValueError):
        build_netlist(params)


def test_generated_netlist_never_leaks_a_host_path() -> None:
    netlist = build_netlist(Sky130FloatingBulkParameters())
    assert "/home/" not in netlist
    assert "/pdk/sky130A" not in netlist.replace(PDK_CONTAINER_ROOT, "")
    assert len([ln for ln in netlist.splitlines() if ln.upper().startswith(".LIB")]) == 1


def test_stored_request_round_trips_with_parameters() -> None:
    request = make(w_um=2.0)
    stored = StoredJobRequest.model_validate(
        {
            "job_id": "job_" + "a" * 32,
            "user_id": "opaque",
            "name": request.name,
            "template_id": SKY130_TEMPLATE_ID,
            "timeout_seconds": 30,
            "idempotency_key_hash": None,
            "body_hash": "0" * 64,
            "created_at": "2026-08-18T00:00:00Z",
            "netlist": request.netlist,
            "requested_outputs": request.requested_outputs,
            "temperature_celsius": request.temperature_celsius,
            "sky130_parameters": request.sky130_parameters.model_dump(),  # type: ignore[union-attr]
        }
    )
    assert stored.sky130_parameters is not None
    assert stored.sky130_parameters.w_um == 2.0


def test_stored_sky130_job_requires_parameters() -> None:
    with pytest.raises(ValidationError):
        StoredJobRequest.model_validate(
            {
                "job_id": "job_" + "a" * 32,
                "user_id": "opaque",
                "name": "Oscilador",
                "template_id": SKY130_TEMPLATE_ID,
                "timeout_seconds": 30,
                "idempotency_key_hash": None,
                "body_hash": "0" * 64,
                "created_at": "2026-08-18T00:00:00Z",
            }
        )


def test_preflight_route_returns_the_generated_netlist_read_only(
    settings: Settings, fetcher: FakeJwksFetcher, key_material: KeyMaterial
) -> None:
    client = make_client(settings.model_copy(update={"sky130_template_enabled": True}), fetcher)
    token = make_token(key_material, audience=AUDIENCE)
    response = client.post(
        "/api/jobs/preflight",
        headers=auth_headers(token),
        json={
            "name": "Oscilador",
            "template_id": SKY130_TEMPLATE_ID,
            "sky130_parameters": {},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert body["analysis"] == "tran"
    assert body["sandbox_ready"] is True
    assert body["outputs"] == ["V(vout)", "V(vb)", "V(vg)"]
    assert body["netlist"] is not None
    assert PDK_CONTAINER_ROOT in body["netlist"]
    assert "/home/" not in body["netlist"]


def test_preflight_route_rejects_a_netlist_or_path_supplied_by_the_client(
    settings: Settings, fetcher: FakeJwksFetcher, key_material: KeyMaterial
) -> None:
    client = make_client(settings.model_copy(update={"sky130_template_enabled": True}), fetcher)
    token = make_token(key_material, audience=AUDIENCE)
    for payload in (
        {"netlist": ".lib /etc/passwd tt\n.END\n"},
        {"sky130_parameters": {"device": "../../etc/passwd"}},
    ):
        response = client.post(
            "/api/jobs/preflight",
            headers=auth_headers(token),
            json={
                "name": "Oscilador",
                "template_id": SKY130_TEMPLATE_ID,
                "sky130_parameters": {},
                **payload,
            },
        )
        assert response.status_code == 422
