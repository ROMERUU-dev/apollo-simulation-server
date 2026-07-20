from __future__ import annotations

import hashlib
import json
import os
import stat
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from conftest import FakeJwksFetcher, KeyMaterial, auth_headers, make_client, make_token
from fastapi.testclient import TestClient

from cimasim_api.config import Settings
from cimasim_api.jobs.errors import IdempotencyConflictError
from cimasim_api.jobs.models import JobCreateRequest, JobSummary, RcParameters, StoredJobRequest
from cimasim_api.jobs.service import JobService
from cimasim_api.jobs.store import (
    MAX_ARTIFACT_BYTES,
    SPOOL_DIR_MODE,
    SPOOL_FILE_MODE,
    _body_hash,
)
from cimasim_api.models import Identity


def job_settings(settings: Settings, tmp_path: Path, *, enabled: bool = True) -> Settings:
    return settings.model_copy(
        update={
            "jobs_enabled": enabled,
            "job_spool_root": tmp_path / "spool",
            "job_timeout_seconds": 30,
            "job_active_per_user_limit": 2,
            "job_active_global_limit": 20,
            "job_list_limit": 100,
        }
    )


def headers(key_material: KeyMaterial, *, subject: str = "user-123") -> dict[str, str]:
    return auth_headers(make_token(key_material, subject=subject))


def create_job(client: TestClient, key_material: KeyMaterial, name: str = "Mi prueba RC") -> str:
    response = client.post(
        "/api/jobs",
        json={"name": name, "template_id": "rc_lowpass_fixed_v1"},
        headers=headers(key_material),
    )
    assert response.status_code == 201
    return str(response.json()["job_id"])


def chmod_file(path: Path) -> None:
    os.chmod(path, SPOOL_FILE_MODE)


def assert_private_file(path: Path) -> None:
    mode = path.stat(follow_symlinks=False).st_mode
    assert stat.S_ISREG(mode)
    assert stat.S_IMODE(mode) == SPOOL_FILE_MODE


def assert_private_dir(path: Path) -> None:
    mode = path.stat(follow_symlinks=False).st_mode
    assert stat.S_ISDIR(mode)
    assert stat.S_IMODE(mode) == SPOOL_DIR_MODE
    assert mode & stat.S_ISGID


def test_create_job_writes_manifest(
    settings: Settings,
    tmp_path: Path,
    key_material: KeyMaterial,
    fetcher: FakeJwksFetcher,
) -> None:
    with make_client(job_settings(settings, tmp_path), fetcher) as client:
        job_id = create_job(client, key_material)

    job_dir = tmp_path / "spool" / "jobs" / job_id
    request = json.loads((job_dir / "request.json").read_text())
    assert request["template_id"] == "rc_lowpass_fixed_v1"
    assert request["simulator"] == "xyce"
    assert "queued" == json.loads((job_dir / "status.json").read_text())["status"]
    assert (tmp_path / "spool" / "queued" / f"{job_id}.json").is_file()
    for directory in (
        tmp_path / "spool",
        tmp_path / "spool" / "jobs",
        job_dir,
        job_dir / "artifacts",
    ):
        assert_private_dir(directory)
    for file_path in (
        job_dir / "request.json",
        job_dir / "status.json",
        tmp_path / "spool" / "queued" / f"{job_id}.json",
        tmp_path / "spool" / ".jobs.lock",
    ):
        assert_private_file(file_path)


def test_rejects_invalid_template_extra_fields_and_long_name(
    client: TestClient,
    key_material: KeyMaterial,
) -> None:
    base_headers = headers(key_material)
    invalid = client.post(
        "/api/jobs",
        json={"name": "x", "template_id": "other"},
        headers=base_headers,
    )
    extra = client.post(
        "/api/jobs",
        json={"name": "x", "template_id": "rc_lowpass_fixed_v1", "netlist": "bad"},
        headers=base_headers,
    )
    too_long = client.post(
        "/api/jobs",
        json={"name": "x" * 121, "template_id": "rc_lowpass_fixed_v1"},
        headers=base_headers,
    )
    control = client.post(
        "/api/jobs",
        json={"name": "bad\nname", "template_id": "rc_lowpass_fixed_v1"},
        headers=base_headers,
    )
    assert invalid.status_code == 422
    assert extra.status_code == 422
    assert too_long.status_code == 422
    assert control.status_code == 422


def test_concurrent_idempotency_returns_single_job(
    settings: Settings,
    tmp_path: Path,
) -> None:
    service = JobService(job_settings(settings, tmp_path))
    identity = Identity(user_id="user-123", email="user@example.test")
    request = JobCreateRequest(name="A", template_id="rc_lowpass_fixed_v1")

    def submit() -> tuple[str, int]:
        job, status_code = service.create_job(identity, request, "same-key")
        return job.job_id, status_code

    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(lambda _index: submit(), range(8)))

    job_ids = {job_id for job_id, _status_code in results}
    status_codes = sorted(status_code for _job_id, status_code in results)
    assert len(job_ids) == 1
    assert status_codes == [200, 200, 200, 200, 200, 200, 200, 201]


def test_concurrent_user_limit_is_atomic(
    settings: Settings,
    tmp_path: Path,
) -> None:
    limited = job_settings(settings, tmp_path).model_copy(update={"job_active_per_user_limit": 2})
    service = JobService(limited)
    identity = Identity(user_id="user-123", email="user@example.test")

    def submit(index: int) -> int:
        try:
            service.create_job(
                identity,
                JobCreateRequest(name=f"Job {index}", template_id="rc_lowpass_fixed_v1"),
                None,
            )
        except Exception as exc:  # noqa: BLE001
            return getattr(exc, "status_code", 500)
        return 201

    with ThreadPoolExecutor(max_workers=8) as executor:
        status_codes = sorted(executor.map(submit, range(8)))

    assert status_codes == [201, 201, 429, 429, 429, 429, 429, 429]


def test_idempotency_and_conflict(
    settings: Settings,
    tmp_path: Path,
    key_material: KeyMaterial,
    fetcher: FakeJwksFetcher,
) -> None:
    with make_client(job_settings(settings, tmp_path), fetcher) as client:
        first = client.post(
            "/api/jobs",
            json={"name": "A", "template_id": "rc_lowpass_fixed_v1"},
            headers={**headers(key_material), "Idempotency-Key": "key-1"},
        )
        second = client.post(
            "/api/jobs",
            json={"name": "A", "template_id": "rc_lowpass_fixed_v1"},
            headers={**headers(key_material), "Idempotency-Key": "key-1"},
        )
        conflict = client.post(
            "/api/jobs",
            json={"name": "B", "template_id": "rc_lowpass_fixed_v1"},
            headers={**headers(key_material), "Idempotency-Key": "key-1"},
        )
    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["job_id"] == second.json()["job_id"]
    assert conflict.status_code == 409


def test_limits_and_spool_unavailable(
    settings: Settings,
    tmp_path: Path,
    key_material: KeyMaterial,
    fetcher: FakeJwksFetcher,
) -> None:
    limited = job_settings(settings, tmp_path).model_copy(update={"job_active_per_user_limit": 1})
    with make_client(limited, fetcher) as client:
        create_job(client, key_material)
        response = client.post(
            "/api/jobs",
            json={"name": "B", "template_id": "rc_lowpass_fixed_v1"},
            headers=headers(key_material),
        )
    assert response.status_code == 429

    with make_client(job_settings(settings, tmp_path, enabled=False), fetcher) as client:
        unavailable = client.get("/api/jobs", headers=headers(key_material))
    assert unavailable.status_code == 503


def test_global_limit(
    settings: Settings,
    tmp_path: Path,
    key_material: KeyMaterial,
    fetcher: FakeJwksFetcher,
) -> None:
    limited = job_settings(settings, tmp_path).model_copy(
        update={"job_active_per_user_limit": 5, "job_active_global_limit": 1}
    )
    with make_client(limited, fetcher) as client:
        create_job(client, key_material)
        response = client.post(
            "/api/jobs",
            json={"name": "B", "template_id": "rc_lowpass_fixed_v1"},
            headers=headers(key_material, subject="other-user"),
        )
    assert response.status_code == 429


def test_spool_root_file_is_unavailable(
    settings: Settings,
    tmp_path: Path,
    key_material: KeyMaterial,
    fetcher: FakeJwksFetcher,
) -> None:
    spool_root = tmp_path / "spool-file"
    spool_root.write_text("not a directory", encoding="utf-8")
    bad_settings = settings.model_copy(update={"jobs_enabled": True, "job_spool_root": spool_root})
    with make_client(bad_settings, fetcher) as client:
        response = client.get("/api/jobs", headers=headers(key_material))
    assert response.status_code == 503


def test_user_isolation_list_and_get(
    settings: Settings,
    tmp_path: Path,
    key_material: KeyMaterial,
    fetcher: FakeJwksFetcher,
) -> None:
    with make_client(job_settings(settings, tmp_path), fetcher) as client:
        job_id = create_job(client, key_material)
        other_headers = headers(key_material, subject="other-user")
        assert client.get(f"/api/jobs/{job_id}", headers=other_headers).status_code == 404
        assert client.get("/api/jobs", headers=other_headers).json()["jobs"] == []


def test_corrupt_json_and_symlink_are_controlled(
    settings: Settings,
    tmp_path: Path,
    key_material: KeyMaterial,
    fetcher: FakeJwksFetcher,
) -> None:
    with make_client(job_settings(settings, tmp_path), fetcher) as client:
        job_id = create_job(client, key_material)
        (tmp_path / "spool" / "jobs" / job_id / "status.json").write_text("{bad", encoding="utf-8")
        assert client.get(f"/api/jobs/{job_id}", headers=headers(key_material)).status_code == 404

    symlink_root = tmp_path / "symlink-spool"
    symlink_root.symlink_to(tmp_path / "target")
    bad_settings = settings.model_copy(
        update={"jobs_enabled": True, "job_spool_root": symlink_root}
    )
    with make_client(bad_settings, fetcher) as client:
        assert client.get("/api/jobs", headers=headers(key_material)).status_code == 503


def test_artifact_download_headers_and_failures(
    settings: Settings,
    tmp_path: Path,
    key_material: KeyMaterial,
    fetcher: FakeJwksFetcher,
) -> None:
    with make_client(job_settings(settings, tmp_path), fetcher) as client:
        job_id = create_job(client, key_material)
        job_dir = tmp_path / "spool" / "jobs" / job_id
        assert (
            client.get(
                f"/api/jobs/{job_id}/artifacts/waveform.csv",
                headers=headers(key_material),
            ).status_code
            == 404
        )
        (job_dir / "status.json").write_text(
            json.dumps(
                {
                    "job_id": job_id,
                    "user_id": "user-123",
                    "status": "succeeded",
                    "created_at": "2026-01-01T00:00:00+00:00",
                    "updated_at": "2026-01-01T00:00:00+00:00",
                }
            ),
            encoding="utf-8",
        )
        chmod_file(job_dir / "status.json")
        (job_dir / "summary.json").write_text(
            json.dumps(
                {
                    "status": "succeeded",
                    "simulator": "xyce",
                    "template": "rc_lowpass_fixed_v1",
                    "artifacts": [
                        {"filename": "waveform.csv", "content_type": "text/csv", "size_bytes": 4}
                    ],
                }
            ),
            encoding="utf-8",
        )
        chmod_file(job_dir / "summary.json")
        artifact = job_dir / "artifacts" / "waveform.csv"
        artifact.write_text("a,b\n", encoding="utf-8")
        chmod_file(artifact)
        response = client.get(
            f"/api/jobs/{job_id}/artifacts/waveform.csv",
            headers=headers(key_material),
        )
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["content-type"].startswith("text/csv")
        artifact.write_bytes(b"x" * (MAX_ARTIFACT_BYTES + 1))
        chmod_file(artifact)
        assert (
            client.get(
                f"/api/jobs/{job_id}/artifacts/waveform.csv",
                headers=headers(key_material),
            ).status_code
            == 404
        )


def test_artifact_symlink_is_rejected(
    settings: Settings,
    tmp_path: Path,
    key_material: KeyMaterial,
    fetcher: FakeJwksFetcher,
) -> None:
    with make_client(job_settings(settings, tmp_path), fetcher) as client:
        job_id = create_job(client, key_material)
        job_dir = tmp_path / "spool" / "jobs" / job_id
        (job_dir / "status.json").write_text(
            json.dumps(
                {
                    "job_id": job_id,
                    "user_id": "user-123",
                    "status": "succeeded",
                    "created_at": "2026-01-01T00:00:00+00:00",
                    "updated_at": "2026-01-01T00:00:00+00:00",
                }
            ),
            encoding="utf-8",
        )
        chmod_file(job_dir / "status.json")
        (job_dir / "summary.json").write_text(
            json.dumps(
                {
                    "status": "succeeded",
                    "simulator": "xyce",
                    "template": "rc_lowpass_fixed_v1",
                    "artifacts": [
                        {"filename": "waveform.csv", "content_type": "text/csv", "size_bytes": 4}
                    ],
                }
            ),
            encoding="utf-8",
        )
        chmod_file(job_dir / "summary.json")
        (job_dir / "artifacts" / "waveform.csv").symlink_to("/etc/passwd")
        response = client.get(
            f"/api/jobs/{job_id}/artifacts/waveform.csv",
            headers=headers(key_material),
        )
    assert response.status_code == 404


def test_no_store_on_job_endpoints(
    settings: Settings,
    tmp_path: Path,
    key_material: KeyMaterial,
    fetcher: FakeJwksFetcher,
) -> None:
    with make_client(job_settings(settings, tmp_path), fetcher) as client:
        job_id = create_job(client, key_material)
        for response in (
            client.get("/api/jobs", headers=headers(key_material)),
            client.get(f"/api/jobs/{job_id}", headers=headers(key_material)),
            client.get(f"/api/jobs/{job_id}/artifacts", headers=headers(key_material)),
        ):
            assert response.headers["cache-control"] == "no-store"


def test_head_is_authenticated_on_all_published_job_routes(
    settings: Settings,
    tmp_path: Path,
    fetcher: FakeJwksFetcher,
) -> None:
    job_id = "job_00000000000000000000000000000000"
    with make_client(job_settings(settings, tmp_path), fetcher) as client:
        for path in (
            "/api/jobs",
            f"/api/jobs/{job_id}",
            f"/api/jobs/{job_id}/artifacts",
            f"/api/jobs/{job_id}/artifacts/waveform.csv",
        ):
            response = client.head(path)
            assert response.status_code == 401
            assert response.headers["cache-control"] == "no-store"


PARAMETERS = {
    "resistance_ohms": 1000,
    "capacitance_farads": 1e-6,
    "input_voltage_volts": 1,
    "duration_seconds": 0.005,
}


def test_parameterized_request_writes_numeric_manifest_and_metadata(
    settings: Settings,
    tmp_path: Path,
    key_material: KeyMaterial,
    fetcher: FakeJwksFetcher,
) -> None:
    configured = job_settings(settings, tmp_path)
    with make_client(configured, fetcher) as client:
        response = client.post(
            "/api/jobs",
            json={
                "name": "RC personalizada",
                "template_id": "rc_lowpass_param_v1",
                "parameters": PARAMETERS,
            },
            headers=headers(key_material),
        )
    assert response.status_code == 201
    body = response.json()
    assert body["parameters"] == PARAMETERS
    assert body["derived"] == {"time_constant_seconds": 0.001}
    request = json.loads(
        (tmp_path / "spool" / "jobs" / body["job_id"] / "request.json").read_text(encoding="utf-8")
    )
    assert request["parameters"] == PARAMETERS
    assert all(isinstance(value, (int, float)) for value in request["parameters"].values())


def test_fixed_request_remains_exact_and_rejects_parameters(
    settings: Settings,
    tmp_path: Path,
    key_material: KeyMaterial,
    fetcher: FakeJwksFetcher,
) -> None:
    with make_client(job_settings(settings, tmp_path), fetcher) as client:
        job_id = create_job(client, key_material)
        explicit_parameters = client.post(
            "/api/jobs",
            json={
                "name": "fixed",
                "template_id": "rc_lowpass_fixed_v1",
                "parameters": None,
            },
            headers=headers(key_material),
        )
    request = json.loads(
        (tmp_path / "spool" / "jobs" / job_id / "request.json").read_text(encoding="utf-8")
    )
    assert "parameters" not in request
    assert explicit_parameters.status_code == 422


def test_parameterized_request_requires_exact_parameter_schema(
    client: TestClient,
    key_material: KeyMaterial,
) -> None:
    base = {"name": "RC", "template_id": "rc_lowpass_param_v1"}
    cases = [
        base,
        {**base, "parameters": {**PARAMETERS, "extra": 1}},
        {
            **base,
            "parameters": {
                key: value for key, value in PARAMETERS.items() if key != "resistance_ohms"
            },
        },
        {**base, "parameters": {**PARAMETERS, "resistance_ohms": "1k"}},
        {**base, "parameters": {**PARAMETERS, "resistance_ohms": [1000]}},
        {**base, "parameters": {**PARAMETERS, "resistance_ohms": {"value": 1000}}},
        {**base, "parameters": {**PARAMETERS}, "netlist": "R1 in out 1k"},
        {**base, "parameters": {**PARAMETERS}, "command": "Xyce"},
    ]
    for payload in cases:
        assert (
            client.post("/api/jobs", json=payload, headers=headers(key_material)).status_code == 422
        )


def test_parameterized_request_rejects_non_finite_numbers(
    client: TestClient,
    key_material: KeyMaterial,
) -> None:
    for token in ("NaN", "Infinity", "-Infinity"):
        payload = json.dumps(
            {
                "name": "RC",
                "template_id": "rc_lowpass_param_v1",
                "parameters": PARAMETERS,
            }
        ).replace("1000", token, 1)
        response = client.post(
            "/api/jobs",
            content=payload,
            headers={**headers(key_material), "Content-Type": "application/json"},
        )
        assert response.status_code == 422


def test_parameter_limits_accept_valid_boundaries() -> None:
    valid_cases = [
        {**PARAMETERS, "resistance_ohms": 1, "duration_seconds": 1e-6},
        {
            **PARAMETERS,
            "resistance_ohms": 10_000_000,
            "capacitance_farads": 1e-12,
            "duration_seconds": 1e-5,
        },
        {
            **PARAMETERS,
            "capacitance_farads": 1e-12,
            "resistance_ohms": 10_000_000,
            "duration_seconds": 1e-5,
        },
        {**PARAMETERS, "capacitance_farads": 1e-2, "resistance_ohms": 1, "duration_seconds": 1e-2},
        {**PARAMETERS, "input_voltage_volts": 0.001},
        {**PARAMETERS, "input_voltage_volts": 10},
        {**PARAMETERS, "duration_seconds": 1e-6, "resistance_ohms": 1},
        {**PARAMETERS, "duration_seconds": 1, "capacitance_farads": 1e-3},
    ]
    for parameters in valid_cases:
        request = JobCreateRequest(
            name="boundary",
            template_id="rc_lowpass_param_v1",
            parameters=RcParameters.model_validate(parameters),
        )
        assert request.parameters is not None


def test_parameter_limits_and_physical_ratio_reject_invalid_values() -> None:
    invalid_cases = [
        {**PARAMETERS, "resistance_ohms": 0.99},
        {**PARAMETERS, "resistance_ohms": 10_000_001},
        {**PARAMETERS, "capacitance_farads": 0.9e-12},
        {**PARAMETERS, "capacitance_farads": 1.1e-2},
        {**PARAMETERS, "input_voltage_volts": 0.0009},
        {**PARAMETERS, "input_voltage_volts": 10.1},
        {**PARAMETERS, "duration_seconds": 0.9e-6},
        {**PARAMETERS, "duration_seconds": 1.1},
        {
            **PARAMETERS,
            "resistance_ohms": 10_000_000,
            "capacitance_farads": 1e-2,
            "duration_seconds": 1e-6,
        },
        {**PARAMETERS, "resistance_ohms": 1, "capacitance_farads": 1e-12, "duration_seconds": 1},
    ]
    for parameters in invalid_cases:
        with pytest.raises(ValueError):
            JobCreateRequest(
                name="invalid",
                template_id="rc_lowpass_param_v1",
                parameters=RcParameters.model_validate(parameters),
            )


def test_parameterized_idempotency_and_conflict(
    settings: Settings,
    tmp_path: Path,
) -> None:
    service = JobService(job_settings(settings, tmp_path))
    identity = Identity(user_id="user-123", email="user@example.test")
    first_request = JobCreateRequest(
        name="RC",
        template_id="rc_lowpass_param_v1",
        parameters=RcParameters.model_validate(PARAMETERS),
    )
    changed_request = JobCreateRequest(
        name="RC",
        template_id="rc_lowpass_param_v1",
        parameters=RcParameters.model_validate({**PARAMETERS, "input_voltage_volts": 3.3}),
    )
    first, first_status = service.create_job(identity, first_request, "param-key")
    replay, replay_status = service.create_job(identity, first_request, "param-key")
    assert first_status == 201
    assert replay_status == 200
    assert first.job_id == replay.job_id
    with pytest.raises(IdempotencyConflictError):
        service.create_job(identity, changed_request, "param-key")


def test_historical_fixed_manifest_and_summary_remain_valid() -> None:
    historical = {
        "job_id": "job_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "user_id": "user-1",
        "name": "Historical RC",
        "template_id": "rc_lowpass_fixed_v1",
        "simulator": "xyce",
        "timeout_seconds": 30,
        "idempotency_key_hash": None,
        "body_hash": None,
        "created_at": "2026-01-01T00:00:00+00:00",
    }
    stored = StoredJobRequest.model_validate(historical)
    summary = JobSummary.model_validate(
        {
            "status": "succeeded",
            "simulator": "xyce",
            "template": "rc_lowpass_fixed_v1",
            "samples": 2013,
            "duration_seconds": 0.005,
            "elapsed_seconds": 0.2,
            "error": None,
            "artifacts": [],
        }
    )
    assert stored.parameters is None
    assert summary.parameters is None
    assert summary.derived is None


def test_stored_manifest_enforces_template_parameter_pair() -> None:
    base = {
        "job_id": "job_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "user_id": "user-1",
        "name": "Stored RC",
        "simulator": "xyce",
        "timeout_seconds": 30,
        "created_at": "2026-01-01T00:00:00Z",
    }
    with pytest.raises(ValueError):
        StoredJobRequest.model_validate({**base, "template_id": "rc_lowpass_param_v1"})
    with pytest.raises(ValueError):
        StoredJobRequest.model_validate(
            {**base, "template_id": "rc_lowpass_fixed_v1", "parameters": None}
        )


def test_fixed_body_hash_remains_historically_stable() -> None:
    request = JobCreateRequest(name="A", template_id="rc_lowpass_fixed_v1")
    expected = hashlib.sha256(b'{"name":"A","template_id":"rc_lowpass_fixed_v1"}').hexdigest()
    assert _body_hash(request) == expected
