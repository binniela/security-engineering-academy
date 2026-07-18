from fde_api_academy.mock_api.client import MockAPIClient


def test_mock_get_response():
    response = MockAPIClient().get("github_user", username="octocat")
    assert response.status_code == 200
    assert response.ok
    assert response.json()["login"] == "octocat"


def test_mock_post_validation():
    client = MockAPIClient()
    assert client.post("records", {}).status_code == 400
    created = client.post("records", {"name": "Ada"})
    assert created.status_code == 201
    assert created.json()["id"] == 101
