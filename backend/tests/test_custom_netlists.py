from __future__ import annotations

import json
from pathlib import Path

import pytest
from conftest import FakeJwksFetcher, KeyMaterial, auth_headers, make_client, make_token
from hypothesis import given
from hypothesis import settings as hypothesis_settings
from hypothesis import strategies as st
from pydantic import ValidationError

from cimasim_api.config import Settings
from cimasim_api.custom_netlists.parser import (
    NORMALIZED_TITLE,
    NetlistValidationError,
    parse_netlist,
)
from cimasim_api.jobs.models import JobCreateRequest, StoredJobRequest

TRAN = """* bounded custom transient
V1 in 0 PULSE(0 1 0 1u 1u 1m 2m)
R1 in out 1k
C1 out 0 1u
.TRAN 1u 1m
.PRINT TRAN V(in)
.END
"""

DC = """* bounded custom dc
V1 in 0 0
R1 in 0 1k
.DC V1 0 5 0.1
.END
"""

AC = """* bounded custom ac
V1 in 0 AC 1
R1 in out 1k
C1 out 0 1u
.AC DEC 10 1 1e6
.END
"""

MOS_TRAN = """* bounded nmos transient
VDD vdd 0 DC 5
VIN gate 0 PULSE(0 5 0 1n 1n 10n 20n)
M1 out gate 0 0 NMOS_THESIS L=1u W=10u
RLOAD vdd out 10k
CLOAD out 0 1p
.MODEL NMOS_THESIS NMOS (LEVEL=1 VTO=0.7 KP=120u LAMBDA=0.02)
.TRAN 0.1n 80n
.END
"""


@pytest.mark.parametrize(("netlist", "analysis"), [(TRAN, "tran"), (DC, "dc"), (AC, "ac")])
def test_parses_supported_analyses_and_replaces_print(netlist: str, analysis: str) -> None:
    parsed = parse_netlist(netlist, ["V(out)"], 25.0)
    assert parsed.analysis == analysis
    assert parsed.outputs == ("V(out)",)
    assert parsed.normalized.count(".PRINT") == 1
    assert ".OPTIONS DEVICE TEMP=25" in parsed.normalized
    assert "FORMAT=CSV" in parsed.normalized
    if analysis == "dc":
        assert ".PRINT DC FORMAT=CSV V1 V(out)" in parsed.normalized


def test_normalized_netlist_uses_fixed_synthetic_title() -> None:
    parsed = parse_netlist(
        """* user supplied project title
* user@example.invalid job_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
V1 in 0 1
R1 in out 1k
.TRAN 1u 1m
.END
""",
        ["V(out)"],
        25.0,
    )
    lines = parsed.normalized.splitlines()
    assert lines[0] == NORMALIZED_TITLE
    assert lines[1] == "V1 in 0 1"
    assert "user supplied project title" not in parsed.normalized
    assert "user@example.invalid" not in parsed.normalized
    assert "job_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" not in parsed.normalized


@pytest.mark.parametrize(
    "line",
    [
        ".INCLUDE secret.cir",
        ".INC secret.cir",
        ".LIB models.lib",
        ".CONTROL",
        ".PLUGIN bad",
        ".UNKNOWN value",
        ".OPTIONS OUTPUT FILE=leak",
        ".TEMP 25",
    ],
)
def test_blocks_file_control_plugin_and_unknown_directives(line: str) -> None:
    with pytest.raises(NetlistValidationError):
        parse_netlist(f"* test\nR1 a 0 1k\n{line}\n.TRAN 1u 1m\n.END\n", ["V(a)"], 25.0)


@pytest.mark.parametrize("token", ["../../etc/passwd", "/root/out", "file://host/a", "a\\b"])
def test_blocks_paths(token: str) -> None:
    with pytest.raises(NetlistValidationError):
        parse_netlist(f"* test\nR1 a 0 {token}\n.TRAN 1u 1m\n.END\n", ["V(a)"], 25.0)


def test_parses_inline_mosfet_model_and_current_output() -> None:
    parsed = parse_netlist(MOS_TRAN, ["V(out)", "I(VDD)"], -40.0)
    assert parsed.models == 1
    assert parsed.devices == 5
    assert ".MODEL NMOS_THESIS NMOS" in parsed.normalized
    assert ".OPTIONS DEVICE TEMP=-40" in parsed.normalized
    assert ".PRINT TRAN FORMAT=CSV V(out) I(VDD)" in parsed.normalized


@pytest.mark.parametrize(
    "model_line",
    [
        ".MODEL 1BAD NMOS (LEVEL=1 VTO=0.7 KP=120u)",
        ".MODEL NMOS_THESIS PMOSX (LEVEL=1 VTO=0.7 KP=120u)",
        ".MODEL NMOS_THESIS NMOS (LEVEL=1 VTO=0.7 UNKNOWN=1)",
        ".MODEL NMOS_THESIS NMOS (" + " ".join(f"VTO{i}=0.7" for i in range(40)) + ")",
        ".MODEL NMOS_THESIS NMOS (LEVEL=1 VTO=nan KP=120u)",
    ],
)
def test_rejects_unsafe_model_definitions(model_line: str) -> None:
    netlist = MOS_TRAN.replace(
        ".MODEL NMOS_THESIS NMOS (LEVEL=1 VTO=0.7 KP=120u LAMBDA=0.02)", model_line
    )
    with pytest.raises(NetlistValidationError):
        parse_netlist(netlist, ["V(out)"], 25.0)


@pytest.mark.parametrize("temperature", [-101.0, 201.0, float("nan"), float("inf")])
def test_rejects_invalid_structured_temperature(temperature: float) -> None:
    with pytest.raises(NetlistValidationError):
        parse_netlist(TRAN, ["V(out)"], temperature)


def test_comments_continuations_models_subcircuits_and_parameters() -> None:
    parsed = parse_netlist(
        """* title
.PARAM rv=1k
.SUBCKT low a b
R1 a b {rv}
+ tc=0
.ENDS
X1 in out low
V1 in 0 1
.TRAN 1u 1m
.END
""",
        ["V(out)", "I(V1)"],
    )
    assert parsed.subcircuits == 1
    assert parsed.devices == 3
    assert parsed.nodes >= 3


def test_contract_is_exact_and_custom_is_normalized() -> None:
    request = JobCreateRequest(
        name="Custom",
        template_id="custom_xyce_netlist_v1",
        netlist=TRAN.replace("\n", "\r\n"),
        requested_outputs=["V(out)"],
    )
    assert "\r" not in (request.netlist or "")
    with pytest.raises(ValidationError):
        JobCreateRequest.model_validate(
            {
                "name": "Custom",
                "template_id": "custom_xyce_netlist_v1",
                "netlist": TRAN,
                "requested_outputs": ["V(out)"],
                "temperature_celsius": 25.0,
                "command": "bad",
            }
        )
    with pytest.raises(ValidationError):
        JobCreateRequest.model_validate(
            {
                "name": "Custom",
                "template_id": "custom_xyce_netlist_v1",
                "netlist": TRAN,
                "requested_outputs": ["V(out)"],
                "temperature_celsius": 25.0,
                "parameters": None,
            }
        )


def test_historical_fixed_manifest_remains_valid() -> None:
    stored = StoredJobRequest.model_validate(
        {
            "job_id": "job_" + "0" * 32,
            "user_id": "historical",
            "name": "Legacy",
            "template_id": "rc_lowpass_fixed_v1",
            "simulator": "xyce",
            "timeout_seconds": 30,
            "created_at": "2026-01-01T00:00:00Z",
        }
    )
    assert stored.netlist is None


def test_flags_block_legacy_and_custom_submission(
    settings: Settings,
    fetcher: FakeJwksFetcher,
    key_material: KeyMaterial,
    tmp_path: Path,
) -> None:
    token = auth_headers(make_token(key_material))
    disabled = settings.model_copy(
        update={
            "jobs_enabled": True,
            "job_spool_root": tmp_path / "legacy",
            "allow_legacy_rc_submission": False,
        }
    )
    with make_client(disabled, fetcher) as client:
        legacy = client.post(
            "/api/jobs",
            json={"name": "Legacy", "template_id": "rc_lowpass_fixed_v1"},
            headers=token,
        )
        custom = client.post(
            "/api/jobs",
            json={
                "name": "Custom",
                "template_id": "custom_xyce_netlist_v1",
                "netlist": TRAN,
                "requested_outputs": ["V(out)"],
                "temperature_celsius": 25.0,
            },
            headers=token,
        )
    assert legacy.status_code == 410
    assert legacy.json()["error"]["code"] == "LEGACY_TEMPLATE_DISABLED"
    assert custom.status_code == 503
    assert custom.json()["error"]["code"] == "CUSTOM_NETLISTS_DISABLED"


def test_custom_creation_uses_separate_spool(
    settings: Settings,
    fetcher: FakeJwksFetcher,
    key_material: KeyMaterial,
    tmp_path: Path,
) -> None:
    enabled = settings.model_copy(
        update={
            "jobs_enabled": True,
            "job_spool_root": tmp_path / "legacy",
            "custom_netlists_enabled": True,
            "custom_job_spool_root": tmp_path / "custom",
        }
    )
    with make_client(enabled, fetcher) as client:
        response = client.post(
            "/api/jobs",
            json={
                "name": "Custom",
                "template_id": "custom_xyce_netlist_v1",
                "netlist": TRAN,
                "requested_outputs": ["V(out)"],
                "temperature_celsius": 25.0,
            },
            headers=auth_headers(make_token(key_material)),
        )
    assert response.status_code == 201
    job_id = response.json()["job_id"]
    assert not (tmp_path / "legacy" / "jobs" / job_id).exists()
    manifest = json.loads((tmp_path / "custom" / "jobs" / job_id / "request.json").read_text())
    assert manifest["template_id"] == "custom_xyce_netlist_v1"
    assert ".PRINT TRAN FORMAT=CSV V(out)" in manifest["netlist"]
    assert manifest["temperature_celsius"] == 25.0
    assert ".OPTIONS DEVICE TEMP=25" in manifest["netlist"]


@hypothesis_settings(max_examples=100, deadline=100)
@given(st.text(max_size=2048))
def test_parser_fuzz_is_bounded(value: str) -> None:
    try:
        parse_netlist(value, ["V(out)"])
    except NetlistValidationError:
        pass
