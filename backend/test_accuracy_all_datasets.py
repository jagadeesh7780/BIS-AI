import asyncio
import sys

if hasattr(sys.stdout, "reconfigure"):
    try:
        getattr(sys.stdout, "reconfigure")(encoding="utf-8")
    except Exception:
        pass

from rag import generate_rag_answer, get_chroma_collection, retrieve


async def run_accuracy_tests():
    collection = get_chroma_collection()
    print("=" * 70)
    print(f"DATABASE VERIFICATION: {collection.count()} knowledge items in ChromaDB")
    print("=" * 70)

    test_cases = [
        {
            "category": "Specific Standard (Helmets)",
            "query": "What is the IS standard for protective helmets for two-wheeler riders?"
        },
        {
            "category": "Specific Standard (Structural Steel)",
            "query": "Tell me about IS 2062 structural steel requirements and scope."
        },
        {
            "category": "Manufacturer Ingestion (FMCS)",
            "query": "What is the procedure for a foreign manufacturer to obtain BIS certification under FMCS?"
        },
        {
            "category": "Consumer Ingestion (Verification & App)",
            "query": "How do I check if an ISI mark is genuine using the BIS CARE mobile app?"
        },
        {
            "category": "Consumer Ingestion (HUID Hallmarking)",
            "query": "What is HUID in gold jewellery and how can a consumer verify it?"
        },
        {
            "category": "Student Ingestion (BIS History & Standards Clubs)",
            "query": "What is the role of BIS in educational institutions and how do Standards Clubs work?"
        },
        {
            "category": "Certification Schemes (CRS)",
            "query": "What is the Compulsory Registration Scheme (CRS) for electronics and IT goods?"
        }
    ]

    for idx, tc in enumerate(test_cases, 1):
        print(f"\n[{idx}/{len(test_cases)}] TEST CATEGORY: {tc['category']}")
        print(f"QUERY: '{tc['query']}'")

        # Test Retrieval
        retrieved = retrieve(tc['query'], top_k=3)
        print(f"Retrieved {len(retrieved)} relevant chunks:")
        for r in retrieved:
            print(f"  - [{r['id']}] {r['title']} (Confidence: {r['confidence']}%, Category: {r['category']})")

        # Test Generation
        try:
            result = await generate_rag_answer(tc['query'], language="en")
            print(f"\nAI ANSWER (first 300 chars):\n{result['answer'][:300]}...")
            print(f"Sources cited: {result['sources']}")
            print(f"Response Time: {result['response_time_s']}s")
            print("Status: PASS")
        except Exception as e:
            print(f"Generation ERROR: {e}")
            print("Status: FAIL")
        print("-" * 70)

if __name__ == "__main__":
    asyncio.run(run_accuracy_tests())
