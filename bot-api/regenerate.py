import fitz, re, json, os
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

HERE = os.path.dirname(os.path.abspath(__file__))
PDF_FOLDER = os.path.join(HERE, "pdfs")

all_texts = []

for fname in sorted(os.listdir(PDF_FOLDER)):
    if not fname.lower().endswith(".pdf"):
        continue
    ruta = os.path.join(PDF_FOLDER, fname)
    doc = fitz.open(ruta)
    text = "\n".join(page.get_text() for page in doc)
    all_texts.append((fname, text))
    print(f"  {fname}: {len(text)} chars, {len(doc)} pages")

# Split each document, trying to preserve structure
chunks = []

for fname, text in all_texts:
    # Try splitting by CLAUSULA or ARTICULO boundaries
    pattern = r'(?=(CLAUSULA\s+\d+|ART[ÍI]CULO\s+\d+))'
    parts = re.split(pattern, text, flags=re.I)
    
    # If too few parts, use recursive splitter
    if len(parts) < 3:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500, chunk_overlap=300,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        doc_chunks = splitter.split_text(text)
        for c in doc_chunks:
            chunks.append(f"[{fname}]\n{c}")
        continue
    
    # Re-join split parts (regex split returns interleaved separators and content)
    merged = []
    i = 0
    while i < len(parts):
        match_pat = r'(CLAUSULA\s+\d+|ART[ÍI]CULO\s+\d+)'
        if re.match(match_pat, parts[i], re.I):
            buf = parts[i]
            i += 1
            if i < len(parts) and not re.match(match_pat, parts[i], re.I):
                buf += parts[i]
                i += 1
            merged.append(buf.strip())
        else:
            if parts[i].strip():
                merged.append(parts[i].strip())
            i += 1
    
    # Merge small consecutive chunks
    final = []
    buf = ""
    for m in merged:
        if len(buf) + len(m) < 2000:
            buf += "\n\n" + m
        else:
            if buf:
                final.append(buf.strip())
            buf = m
    if buf:
        final.append(buf.strip())
    
    for c in final:
        chunks.append(f"[{fname}]\n{c}")

print(f"\nTotal chunks: {len(chunks)}")

# Show sample chunks
for i, c in enumerate(chunks[:10]):
    print(f"Chunk {i}: [{len(c):4d} chars] {c.split(chr(10))[0][:100]}")

print("\nGenerating embeddings...")
embeddings = OpenAIEmbeddings(model="text-embedding-ada-002")
emb_vectors = embeddings.embed_documents(chunks)
print(f"Generated {len(emb_vectors)} embeddings (dim={len(emb_vectors[0])})")

data = {"chunks": chunks, "embeddings": emb_vectors}
output = os.path.join(HERE, "..", "src", "lib", "services", "vectorstore-data.json")
with open(output, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)
print(f"\nExported to {output}")
