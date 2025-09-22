#!/bin/bash

echo "🔍 Phase 2 Status Check - Verifying 85% Completion"
echo "=================================================="

cd backend

echo ""
echo "📁 Checking required files..."

# Check all core files exist
files=(
  "src/types/UnifiedContext.ts"
  "src/types/CompanyTypes.ts" 
  "src/core/companies/CompanyManager.ts"
  "src/config/companies.json"
  "src/routes/companies.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file - EXISTS"
  else
    echo "❌ $file - MISSING"
  fi
done

echo ""
echo "🧪 Running comprehensive tests..."

# Run the comprehensive test that should pass
echo "Running: npx ts-node src/test-ai-company-integration.ts"
npx ts-node src/test-ai-company-integration.ts

echo ""
echo "🚀 If all tests pass, you're ready for final completion!"
echo "Next: API route testing and WhatsApp integration update"