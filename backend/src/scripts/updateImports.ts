// File: backend/scripts/updateImports.ts

import fs from 'fs';
import path from 'path';

/**
 * Script to find and update old import statements
 */
class ImportUpdater {
  private readonly srcDir = path.join(__dirname, '/');
  
  private readonly replacements = [
    // Old ChromaDB imports
    {
      from: /import.*from.*['"]chromadb['"];?/g,
      to: '// ChromaDB import removed - now using Pinecone'
    },
    {
      from: /import.*from.*['"]langchain\/vectorstores\/chroma['"];?/g,
      to: '// Chroma vectorstore import removed'
    },
    // Old vector store service imports
    {
      from: /import.*EnhancedVectorStore.*from.*['"]\.\.\/services\/EnhancedVectorStore['"];?/g,
      to: 'import { VectorStoreManager } from "../core/vector/managers/VectorStoreManager";'
    },
    {
      from: /import.*SimpleVectorStore.*from.*['"]\.\.\/services\/SimpleVectorStore['"];?/g,
      to: 'import { VectorStoreManager } from "../core/vector/managers/VectorStoreManager";'
    },
    {
      from: /import.*RAGService.*from.*['"]\.\.\/services\/RAGService['"];?/g,
      to: 'import { VectorStoreManager } from "../core/vector/managers/VectorStoreManager";'
    }
  ];

  async updateAllFiles(): Promise<void> {
    console.log('🔍 Scanning for old imports...');
    
    const files = await this.getAllTsFiles(this.srcDir);
    
    for (const file of files) {
      await this.updateFile(file);
    }
    
    console.log('✅ Import updates completed!');
  }

  private async getAllTsFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and backup directories
        if (!['node_modules', 'backup', 'dist'].includes(entry.name)) {
          files.push(...await this.getAllTsFiles(fullPath));
        }
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private async updateFile(filePath: string): Promise<void> {
    try {
      let content = await fs.promises.readFile(filePath, 'utf-8');
      let hasChanges = false;
      
      for (const replacement of this.replacements) {
        if (replacement.from.test(content)) {
          console.log(`📝 Updating imports in ${path.relative(this.srcDir, filePath)}`);
          content = content.replace(replacement.from, replacement.to);
          hasChanges = true;
        }
      }
      
      // Check for any remaining ChromaDB references
      if (content.includes('chromadb') || content.includes('Chroma')) {
        console.log(`⚠️  Manual review needed in ${path.relative(this.srcDir, filePath)}: Contains ChromaDB references`);
      }
      
      if (hasChanges) {
        await fs.promises.writeFile(filePath, content, 'utf-8');
      }
      
    } catch (error) {
      console.error(`❌ Error updating ${filePath}:`, error);
    }
  }

  async generateImportReport(): Promise<void> {
    console.log('📊 Generating import analysis report...');
    
    const files = await this.getAllTsFiles(this.srcDir);
    const report = {
      totalFiles: files.length,
      chromaReferences: 0,
      updatedFiles: 0,
      manualReviewNeeded: [] as string[]
    };

    for (const file of files) {
      const content = await fs.promises.readFile(file, 'utf-8');
      
      if (content.includes('chromadb') || content.includes('Chroma')) {
        report.chromaReferences++;
        report.manualReviewNeeded.push(path.relative(this.srcDir, file));
      }
    }

    console.log('\n📋 Import Analysis Report:');
    console.log(`Total TypeScript files: ${report.totalFiles}`);
    console.log(`Files with ChromaDB references: ${report.chromaReferences}`);
    
    if (report.manualReviewNeeded.length > 0) {
      console.log('\n⚠️  Files needing manual review:');
      report.manualReviewNeeded.forEach(file => console.log(`  - ${file}`));
    } else {
      console.log('✅ No ChromaDB references found!');
    }
  }
}

// Usage example
const updater = new ImportUpdater();

// Run import updates
updater.updateAllFiles()
  .then(() => updater.generateImportReport())
  .catch(console.error);

export { ImportUpdater };