// File: backend/src/scripts/migrateKnowledgeBase.ts

import { VectorStoreManager } from '../core/vector/managers/VectorStoreManager';
import { VectorDocument } from '../core/vector/interfaces/VectorStoreProvider';
import { enhancedKnowledgeBase, EnhancedRAGDocument } from '../data/enhanced-knowledge-base';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Migration script to move knowledge base from ChromaDB to Pinecone
 */
export class KnowledgeBaseMigration {
  private vectorManager: VectorStoreManager;

  constructor() {
    this.vectorManager = VectorStoreManager.getInstance();
  }

  async migrate(): Promise<void> {
    try {
      console.log('🚀 Starting knowledge base migration to Pinecone...');
      
      const vectorStore = await this.vectorManager.initialize();
      const vectorDocuments = this.convertToVectorDocuments(enhancedKnowledgeBase);
      
      console.log(`📊 Converting ${vectorDocuments.length} documents for migration...`);
      
      // Check if the index has any documents before clearing
      const currentStats = await vectorStore.getStats();
      if (currentStats.documentCount > 0) {
        console.log(`🧹 Clearing ${currentStats.documentCount} existing documents...`);
        await vectorStore.clearCollection();
      } else {
        console.log('ℹ️ Index is already empty. No need to clear.');
      }

      // Add documents to new vector store
      console.log('📝 Adding documents to Pinecone...');
      await vectorStore.addDocuments(vectorDocuments);
      
      // Test queries after migration
      await this.testSearch(vectorStore);

      console.log('🎉 Migration completed successfully!');
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  private convertToVectorDocuments(knowledgeBase: EnhancedRAGDocument[]): VectorDocument[] {
    function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
      const clean: Record<string, any> = {};
      for (const key in metadata) {
        const value = metadata[key];
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          clean[key] = value;
        } else if (Array.isArray(value) && value.every(v => typeof v === "string")) {
          clean[key] = value;
        } else {
          clean[key] = JSON.stringify(value);
        }
      }
      return clean;
    }

    return knowledgeBase.map((doc, index) => {
      const metadata = { ...doc.metadata };
      const safeMetadata = sanitizeMetadata({
        ...metadata,
        migratedAt: new Date().toISOString(),
        source: "enhanced_knowledge_base",
        version: "2.0",
      });

      return {
        id: doc.id || `doc_${index}`,
        content: doc.content,
        metadata: safeMetadata,
      };
    });
  }

  private async testSearch(vectorStore: any): Promise<void> {
    console.log('🔍 Testing search functionality...');
    
    const testQueries = [
      'auto insurance coverage',
      'premium calculation',
      'claims process',
      'health insurance benefits'
    ];

    for (const query of testQueries) {
      try {
        const results = await vectorStore.searchByText(query, 3);
        console.log(`✅ Test query "${query}": Found ${results.length} results`);
        
        if (results.length > 0) {
          console.log(`   Top result: ${results[0].document.content.substring(0, 100)}...`);
        }
      } catch (error) {
        console.error(`❌ Test query "${query}" failed:`, error);
      }
    }
  }

  /**
   * Add sample insurance knowledge if knowledge base is empty
   */
  async addSampleKnowledge(): Promise<void> {
    console.log('📚 Adding sample Ghana insurance knowledge...');
    
    const sampleDocs: VectorDocument[] = [
      {
        id: 'sample_1',
        content: 'Comprehensive auto insurance covers damages to your car and others in an accident.',
        metadata: {
          type: 'auto',
          coverage: 'comprehensive',
          country: 'Ghana',
          migratedAt: new Date().toISOString(),
          source: 'sample_data',
          version: '2.0'
        }
      },
      {
        id: 'sample_2',
        content: 'Health insurance in Ghana includes outpatient, inpatient, and maternity care.',
        metadata: {
          type: 'health',
          coverage: 'basic',
          country: 'Ghana',
          migratedAt: new Date().toISOString(),
          source: 'sample_data',
          version: '2.0'
        }
      }
    ];

    const vectorStore = await this.vectorManager.initialize();
    await vectorStore.addDocuments(sampleDocs);
    console.log('✅ Sample knowledge added successfully');
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  const migration = new KnowledgeBaseMigration();
  migration.migrate().catch((err) => {
    console.error('Migration script failed:', err);
    process.exit(1);
  });
}
