#!/bin/bash
# File: backend/scripts/cleanup_old_dependencies.sh

echo "🧹 Starting cleanup of old ChromaDB dependencies..."

# Remove old ChromaDB package
echo "📦 Removing ChromaDB package..."
cd backend
npm uninstall chromadb

# Archive old vector store files (don't delete in case we need them)
echo "📂 Archiving old vector store files..."
mkdir -p backup/old_vector_stores
mv src/services/EnhancedVectorStore.ts backup/old_vector_stores/ 2>/dev/null || echo "EnhancedVectorStore.ts not found"
mv src/services/SimpleVectorStore.ts backup/old_vector_stores/ 2>/dev/null || echo "SimpleVectorStore.ts not found"
mv src/services/RAGService.ts backup/old_vector_stores/ 2>/dev/null || echo "RAGService.ts not found"

# Remove any ChromaDB data directories if they exist
echo "🗑️ Removing old data directories..."
rm -rf chroma_data 2>/dev/null || echo "No chroma_data directory found"
rm -rf vector_data 2>/dev/null || echo "No vector_data directory found"

# Update .gitignore to include new patterns
echo "📝 Updating .gitignore..."
cat >> .gitignore << EOL

# Vector store data
vector_store_data/
pinecone_cache/
*.vector
backup/

# Old ChromaDB data (archived)
chroma_data/
chromadb/
EOL

echo "✅ Cleanup completed!"
echo "📋 Summary:"
echo "  - Removed ChromaDB package"
echo "  - Archived old vector store files to backup/"
echo "  - Cleaned up data directories"
echo "  - Updated .gitignore"
echo ""
echo "🔍 Next steps:"
echo "  1. Update any remaining imports"
echo "  2. Test the new vector store integration"
echo "  3. Run npm audit to check for vulnerabilities"