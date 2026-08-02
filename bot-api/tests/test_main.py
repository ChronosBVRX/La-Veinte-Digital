import importlib
import os

import pytest
from fastapi.testclient import TestClient

import main

SECRET = "ci-test-secret"


def make_client() -> TestClient:
    return TestClient(main.app)


def test_health_ok():
    res = make_client().get("/health", headers={"X-Bot-Secret": SECRET})
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_health_requires_secret():
    res = make_client().get("/health")
    assert res.status_code == 401


def test_health_rejects_wrong_secret():
    res = make_client().get("/health", headers={"X-Bot-Secret": "wrong"})
    assert res.status_code == 401


def test_index_served():
    res = make_client().get("/")
    assert res.status_code == 200
    assert "html" in res.headers.get("content-type", "").lower()


def test_consulta_requires_secret():
    res = make_client().post(
        "/consulta",
        json={"history": [{"role": "user", "content": "hola"}]},
    )
    assert res.status_code == 401


def test_consulta_empty_history():
    res = make_client().post(
        "/consulta",
        json={"history": []},
        headers={"X-Bot-Secret": SECRET},
    )
    assert res.status_code == 200
    assert "pregunta" in res.json()["respuesta"]


def test_consulta_greeting_shortcut_does_not_call_llm(monkeypatch):
    def boom(*args, **kwargs):
        raise AssertionError("no debe llamarse consulta_contrato en un saludo")

    monkeypatch.setattr(main, "consulta_contrato", boom)
    res = make_client().post(
        "/consulta",
        json={"history": [{"role": "user", "content": "Hola"}]},
        headers={"X-Bot-Secret": SECRET},
    )
    assert res.status_code == 200
    assert "Asistente SNTSS" in res.json()["respuesta"]


def test_consulta_without_user_message(monkeypatch):
    def boom(*args, **kwargs):
        raise AssertionError("no debe llamarse consulta_contrato sin pregunta")

    monkeypatch.setattr(main, "consulta_contrato", boom)
    res = make_client().post(
        "/consulta",
        json={"history": [{"role": "assistant", "content": "hola"}]},
        headers={"X-Bot-Secret": SECRET},
    )
    assert res.status_code == 200
    assert res.json()["respuesta"] == "No pude encontrar tu pregunta en el historial."


def test_consulta_happy_path(monkeypatch):
    captured = {}

    def fake_consulta(question, history):
        captured["question"] = question
        captured["history"] = history
        return "respuesta de prueba"

    monkeypatch.setattr(main, "consulta_contrato", fake_consulta)
    res = make_client().post(
        "/consulta",
        json={"history": [{"role": "user", "content": "¿Qué dice la cláusula 47?"}]},
        headers={"X-Bot-Secret": SECRET},
    )
    assert res.status_code == 200
    assert res.json()["respuesta"] == "respuesta de prueba"
    assert captured["question"] == "¿Qué dice la cláusula 47?"
    assert captured["history"] == [{"role": "user", "content": "¿Qué dice la cláusula 47?"}]


def test_consulta_rejects_invalid_role():
    res = make_client().post(
        "/consulta",
        json={"history": [{"role": "admin", "content": "x"}]},
        headers={"X-Bot-Secret": SECRET},
    )
    assert res.status_code == 422


def test_service_unconfigured_returns_503(monkeypatch):
    env_path = os.path.join(os.path.dirname(main.__file__), ".env")
    if os.path.exists(env_path):
        pytest.skip("bot-api/.env presente localmente; esta prueba solo aplica sin .env")

    monkeypatch.delenv("BOT_API_SHARED_SECRET", raising=False)
    try:
        reloaded = importlib.reload(main)
        res = TestClient(reloaded.app).get("/health")
        assert res.status_code == 503
    finally:
        monkeypatch.setenv("BOT_API_SHARED_SECRET", SECRET)
        importlib.reload(main)
