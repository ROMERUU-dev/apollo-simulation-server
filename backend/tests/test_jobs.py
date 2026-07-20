from __future__ import annotations

import json
import os
import stat
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from conftest import FakeJwksFetcher, KeyMaterial, auth_headers, make_client, make_token
from fastapi.testclient import TestClient

from cimasim_api.config import Settings
from cimasim_api.jobs.models import JobCreateRequest
from cimasim_api.jobs.service import JobService
from cimasim_api.jobs.store import MAX_ARTIFACT_BYTES, SPOOL_DIR_MODE, SPOOL_FILE_MODE
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
