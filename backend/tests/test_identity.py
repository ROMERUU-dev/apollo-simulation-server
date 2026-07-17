from conftest import auth_headers, make_token
from fastapi.testclient import TestClient


def test_me_returns_validated_identity(client: TestClient, key_material) -> None:
    token = make_token(key_material, subject="abc-123", email="Usuario@UABC.edu.mx")

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["user_id"] == "cf-sub:abc-123"
    assert body["email"] == "usuario@uabc.edu.mx"
    assert body["roles"] == ["user"]
    assert body["is_admin"] is False
    assert "name" not in body
    assert "groups" not in body
    assert body["limits"]["active_jobs_per_user"] == 2
    assert body["limits"]["max_sweep_runs"] == 100
    assert body["limits"]["job_timeout_seconds"] == 1800
    assert body["limits"]["storage_bytes"] == 1073741824


def test_me_returns_null_name_when_claim_is_present_as_null(
    client: TestClient, key_material
) -> None:
    token = make_token(key_material, extra_claims={"name": None})

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 200
    assert "name" not in response.json()


def test_me_returns_groups_only_when_validated_claim_exists(
    client: TestClient, key_material
) -> None:
    token = make_token(key_material, extra_claims={"groups": ["cimasim-users"]})

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json()["groups"] == ["cimasim-users"]


def test_roles_cannot_be_injected_by_headers(client: TestClient, key_material) -> None:
    token = make_token(key_material)

    response = client.get(
        "/api/me",
        headers={
            **auth_headers(token),
            "X-CimaSim-Roles": "admin",
            "X-Forwarded-User": "admin@uabc.edu.mx",
            "Cf-Access-Authenticated-User-Email": "admin@uabc.edu.mx",
        },
    )

    assert response.status_code == 200
    assert response.json()["roles"] == ["user"]
    assert response.json()["is_admin"] is False


def test_email_outside_allowed_domain_is_rejected(client: TestClient, key_material) -> None:
    token = make_token(key_material, email="user@example.com")

    response = client.get("/api/me", headers=auth_headers(token))

    assert response.status_code == 403
    assert response.headers["cache-control"] == "no-store"
