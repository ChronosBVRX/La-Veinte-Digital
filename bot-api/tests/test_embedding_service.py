from embedding_service import (
    NO_INFORMATION_RESPONSE,
    _formatear_contexto,
    _recuperar_fragmentos,
    _split_document,
    consulta_contrato,
)


class FakeDoc:
    def __init__(self, content, metadata):
        self.page_content = content
        self.metadata = metadata


class FakeDB:
    def __init__(self, pairs):
        self.pairs = pairs

    def similarity_search_with_relevance_scores(self, question, k=6):
        return self.pairs[:k]


def test_formatear_contexto_incluye_cabeceras():
    docs = [
        FakeDoc(
            "Texto de la cláusula",
            {"document": "cct.pdf", "page": 3, "section": "CLÁUSULA 47"},
        ),
        FakeDoc("Otro texto", {"document": "estatutos.pdf"}),
    ]
    out = _formatear_contexto(docs)
    assert "[cct.pdf] (página 3) — CLÁUSULA 47" in out
    assert "[estatutos.pdf]" in out
    assert "---" in out


def test_split_document_detecta_secciones():
    text = "preámbulo\nCLÁUSULA 47 primera parte\nCLÁUSULA 48 segunda parte"
    chunks = list(_split_document("cct.txt", text))
    assert len(chunks) >= 3
    assert any(
        "primera" in c[0] and c[1]["section"] == "CLÁUSULA 47" for c in chunks
    )
    assert any(
        "segunda" in c[0] and c[1]["section"] == "CLÁUSULA 48" for c in chunks
    )
    assert all(c[1]["document"] == "cct.txt" for c in chunks)


def test_split_document_fallback_sin_estructura():
    text = "texto plano sin secciones " * 10
    chunks = list(_split_document("doc.txt", text))
    assert len(chunks) >= 1
    assert all(c[1]["section"] is None for c in chunks)


def test_recuperar_fragmentos_filtra_por_umbral():
    db = FakeDB(
        [
            (FakeDoc("uno", {}), 0.6),
            (FakeDoc("dos", {}), 0.3),
            (FakeDoc("tres", {}), 0.9),
        ]
    )
    docs = _recuperar_fragmentos(db, "pregunta")
    assert [d.page_content for d in docs] == ["uno", "tres"]


def test_recuperar_fragmentos_vacio_sin_matches():
    db = FakeDB([(FakeDoc("bajo", {}), 0.1), (FakeDoc("nulo", {}), 0.0)])
    assert _recuperar_fragmentos(db, "pregunta") == []


def test_consulta_contrato_sin_contexto_responde_honestamente(monkeypatch):
    monkeypatch.setattr(
        "embedding_service._cargar_vectorstore",
        lambda embeddings: FakeDB([]),
    )
    resp = consulta_contrato("¿Qué dice sobre viajes espaciales?", [])
    assert resp == NO_INFORMATION_RESPONSE
