// File: backend/src/scripts/populateKnowledgeBase.ts

import { VectorStoreManager } from '../core/vector/managers/VectorStoreManager';
import { VectorDocument } from '../core/vector/interfaces/VectorStoreProvider';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Script to populate knowledge base with comprehensive Ghana insurance data
 */
export class KnowledgeBasePopulator {
  private vectorManager: VectorStoreManager;

  constructor() {
    this.vectorManager = VectorStoreManager.getInstance();
  }

  async populate(): Promise<void> {
    try {
      console.log('📚 Populating knowledge base with Ghana insurance data...');
      
      // Initialize vector store
      const vectorStore = await this.vectorManager.initialize();
      
      // Clear existing documents first
      console.log('🧹 Clearing existing documents...');
      await vectorStore.clearCollection();
      
      // Get comprehensive knowledge base
      const documents = this.getComprehensiveKnowledgeBase();
      
      console.log(`📝 Adding ${documents.length} documents to Pinecone...`);
      
      // Add documents in smaller batches for better performance
      const batchSize = 20;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        await vectorStore.addDocuments(batch);
        console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(documents.length/batchSize)} completed`);
      }
      
      // Verify population
      const stats = await vectorStore.getStats();
      console.log(`✅ Knowledge base populated! ${stats.documentCount} documents added.`);
      
      // Test search functionality
      await this.testKnowledgeSearch(vectorStore);
      
    } catch (error) {
      console.error('❌ Failed to populate knowledge base:', error);
      throw error;
    }
  }

  private getComprehensiveKnowledgeBase(): VectorDocument[] {
    return [
      // AUTO INSURANCE DOCUMENTS
      {
        id: 'gh_auto_insurance_comprehensive',
        content: `Comprehensive Auto Insurance in Ghana provides complete protection for your vehicle. 
        Coverage includes: Third-party liability (mandatory by law), own damage from accidents, theft protection, 
        fire and natural disaster coverage, windscreen protection, and personal accident benefits.
        Premium factors: Vehicle age, make/model, driver's age and experience, location (Accra higher than rural areas), 
        security features, and driving record. Deductibles typically range from GHS 500-2000.
        Required documents: Valid driving license, vehicle registration, roadworthy certificate, and ID card.`,
        metadata: {
          type: 'product',
          category: 'auto_insurance',
          subcategory: 'comprehensive',
          region: 'ghana',
          priority: 'high',
          companyId: 'generic'
        }
      },
      {
        id: 'gh_auto_insurance_third_party',
        content: `Third-Party Auto Insurance in Ghana is mandatory for all vehicles. 
        Covers: Bodily injury to third parties, property damage to other vehicles, legal liability costs.
        Does not cover: Your own vehicle damage, theft of your car, personal injury to you or passengers.
        Cost: Typically GHS 150-400 annually depending on vehicle type. Private cars, commercial vehicles, 
        and motorcycles have different rates. Renewal required annually with valid roadworthy certificate.
        Penalties for driving without insurance: GHS 1,000+ fine and possible vehicle impoundment.`,
        metadata: {
          type: 'product',
          category: 'auto_insurance',
          subcategory: 'third_party',
          region: 'ghana',
          priority: 'high',
          companyId: 'generic'
        }
      },
      {
        id: 'gh_auto_premium_calculation',
        content: `Auto Insurance Premium Calculation in Ghana:
        Base factors: Vehicle value (40%), driver age (20%), location (15%), vehicle type (15%), security (10%).
        Age groups: Under 25 (+50% loading), 25-35 (+20%), 35-55 (base rate), 55+ (+10%).
        Location loadings: Accra (+25%), Kumasi (+15%), Tema (+20%), Other urban (+10%), Rural (base).
        Vehicle categories: Saloon cars (base), SUVs (+15%), Pickups (+10%), Luxury cars (+30%).
        Security discounts: Alarm system (-5%), Tracking device (-10%), Secure parking (-5%).
        No-claims bonus: 1 year (10%), 2 years (15%), 3+ years (20%).`,
        metadata: {
          type: 'premium_calculation',
          category: 'auto_insurance',
          region: 'ghana',
          priority: 'high',
          companyId: 'generic'
        }
      },

      // HEALTH INSURANCE DOCUMENTS
      {
        id: 'gh_health_insurance_nhis',
        content: `National Health Insurance Scheme (NHIS) in Ghana provides basic healthcare coverage.
        Coverage: Outpatient services, inpatient care, maternity care, emergency services, mental health services.
        Premium: Based on income level - informal sector pays fixed annual premium around GHS 48-60.
        Formal sector workers contribute via payroll deductions (2.5% of salary).
        Covered facilities: All NHIS-accredited hospitals and clinics nationwide.
        Exclusions: Cosmetic surgery, overseas treatment, some specialized procedures, private ward accommodation.
        Renewal: Annual renewal required with valid Ghana Card or other acceptable ID.`,
        metadata: {
          type: 'product',
          category: 'health_insurance',
          subcategory: 'nhis',
          region: 'ghana',
          priority: 'high',
          companyId: 'generic'
        }
      },
      {
        id: 'gh_health_insurance_private',
        content: `Private Health Insurance in Ghana supplements NHIS coverage with additional benefits.
        Enhanced coverage: Private hospital access, specialist consultations, overseas treatment, dental care, optical care.
        Premium ranges: Individual (GHS 800-5000/year), Family (GHS 2000-15000/year).
        Factors affecting cost: Age, health status, coverage level, hospital network, deductible amount.
        Popular benefits: Private ward accommodation, no waiting periods, direct billing, emergency evacuation.
        Pre-existing conditions: Waiting period of 6-12 months typically applies.
        Top insurers: Metropolitan, Glico, Star Assurance, Enterprise Insurance.`,
        metadata: {
          type: 'product',
          category: 'health_insurance',
          subcategory: 'private',
          region: 'ghana',
          priority: 'high',
          companyId: 'generic'
        }
      },

      // PAYMENT METHODS
      {
        id: 'gh_payment_mobile_money',
        content: `Mobile Money Payment for Insurance in Ghana:
        MTN MoMo: 60% market share, instant premium payments, GHS 0.75 transaction fee.
        Vodafone Cash: 25% market share, competitive rates, partnerships with major insurers.
        AirtelTigo Money: Growing adoption, often lower fees for insurance payments.
        Payment process: Dial shortcode → Select insurance payment → Enter policy number → Confirm payment.
        Benefits: 24/7 availability, instant confirmation, receipt via SMS, no bank visit required.
        Limits: Daily transaction limits apply (GHS 1000-5000 depending on verification level).
        Auto-renewal: Can set up automatic premium payments for continuous coverage.`,
        metadata: {
          type: 'process',
          category: 'payment',
          subcategory: 'mobile_money',
          region: 'ghana',
          priority: 'high',
          companyId: 'generic'
        }
      },
      {
        id: 'gh_payment_bank_transfer',
        content: `Bank Transfer Payment for Insurance in Ghana:
        Methods: Online banking, mobile banking apps, branch visits, internet banking.
        Major banks: GCB Bank, Ecobank, Standard Chartered, Stanbic, CalBank, ADB.
        Processing time: Same day for online transfers, 1-2 days for branch transactions.
        Documentation: Account details, policy number, reference number required.
        Benefits: Lower fees for large amounts, detailed transaction records, suitable for corporate payments.
        Direct debit: Available for annual policies, automatic renewal, 5-10% discount often available.`,
        metadata: {
          type: 'process',
          category: 'payment',
          subcategory: 'bank_transfer',
          region: 'ghana',
          priority: 'medium',
          companyId: 'generic'
        }
      },

      // CLAIMS PROCESS
      {
        id: 'gh_claims_auto_accident',
        content: `Auto Insurance Claims Process in Ghana:
        Immediate steps: Ensure safety, call police (if injuries/major damage), take photos, exchange information.
        Report to insurer: Within 24-48 hours via hotline, online portal, or agent.
        Required documents: Police report, driving license, insurance certificate, photos, repair estimates.
        Assessment: Insurer sends assessor within 2-5 days, determines damage extent and liability.
        Settlement: Approved claims paid within 7-14 business days.
        Repair process: Choose from approved garages or get cash settlement.
        No-claims bonus: Protected if not at fault, may be affected if at fault.`,
        metadata: {
          type: 'process',
          category: 'claims',
          subcategory: 'auto_accident',
          region: 'ghana',
          priority: 'high',
          companyId: 'generic'
        }
      },
      {
        id: 'gh_claims_health_emergency',
        content: `Health Insurance Emergency Claims in Ghana:
        Emergency situations: Accidents, sudden illness, heart attack, stroke, serious injuries.
        Immediate action: Go to nearest hospital, call insurance emergency line, get treatment.
        Pre-authorization: Many procedures require approval, but emergencies get retrospective approval.
        Documentation: Medical reports, receipts, discharge summary, doctor's recommendations.
        Direct billing: Most private insurers have direct billing with major hospitals.
        Reimbursement: Submit documents within 30 days, payment within 14 days of approval.
        Appeal process: If claim denied, can appeal within 30 days with additional evidence.`,
        metadata: {
          type: 'process',
          category: 'claims',
          subcategory: 'health_emergency',
          region: 'ghana',
          priority: 'high',
          companyId: 'generic'
        }
      },

      // CULTURAL CONTEXT
      {
        id: 'gh_cultural_family_considerations',
        content: `Family and Cultural Considerations for Insurance in Ghana:
        Extended family responsibility: Ghanaians often support parents, siblings, and relatives financially.
        Decision-making: Major insurance decisions often involve spouse, parents, or family head consultation.
        Community support: Traditional community support systems (family, church, social groups) influence insurance decisions.
        Religious considerations: Some may prefer Sharia-compliant insurance products.
        Generational differences: Younger generation more open to insurance, older generation may prefer traditional savings.
        Trust factors: Personal relationships, community endorsements, and referrals are crucial.
        Communication preferences: Face-to-face meetings often preferred for important decisions.`,
        metadata: {
          type: 'market_context',
          category: 'cultural',
          subcategory: 'family',
          region: 'ghana',
          priority: 'medium',
          companyId: 'generic'
        }
      },
      {
        id: 'gh_language_communication',
        content: `Language and Communication in Ghana Insurance:
        Official language: English (used in all documentation and formal communication).
        Major local languages: Twi/Akan (spoken by 49%), Ewe (11%), Ga (7%), Dagbani (4%), Hausa (trade language).
        Communication style: Respectful greetings important, indirect communication common, patience valued.
        Common Twi phrases: "Ɛte sɛn?" (How are you?), "Eye" (It's good), "Medaase" (Thank you).
        Agent support: Many agents speak local languages, especially important in rural areas.
        Document translation: Key policy documents often available in major local languages.
        Cultural sensitivity: Understand local customs, avoid rushing decisions, respect for elders important.`,
        metadata: {
          type: 'market_context',
          category: 'communication',
          subcategory: 'language',
          region: 'ghana',
          priority: 'medium',
          companyId: 'generic'
        }
      },

      // SEASONAL FACTORS
      {
        id: 'gh_seasonal_harmattan',
        content: `Harmattan Season Insurance Considerations in Ghana (November-March):
        Weather impact: Dry dusty winds, reduced visibility, respiratory problems increase.
        Vehicle concerns: Dust damage to engines, paint, windscreens need extra protection.
        Health issues: Asthma, allergies, skin problems more common, higher medical claims.
        Travel risks: Poor visibility increases road accidents, flight delays common.
        Preventive measures: Regular vehicle maintenance, air filters, health check-ups recommended.
        Insurance products: Seasonal health coverage, vehicle protection plans popular.
        Premium adjustments: Some insurers offer seasonal discounts or specific protections.`,
        metadata: {
          type: 'market_context',
          category: 'seasonal',
          subcategory: 'harmattan',
          region: 'ghana',
          priority: 'medium',
          companyId: 'generic'
        }
      },
      {
        id: 'gh_seasonal_rainy_season',
        content: `Rainy Season Insurance Considerations in Ghana (April-October):
        Weather risks: Heavy rains, flooding, storms, lightning strikes.
        Vehicle impact: Flood damage, electrical problems, road accidents increase 30%.
        Property concerns: Roof leaks, foundation damage, electrical system problems.
        Health considerations: Malaria, cholera, waterborne diseases more prevalent.
        Business impact: Transport delays, supply chain disruptions, reduced business activity.
        Insurance focus: Flood coverage, comprehensive auto, business interruption insurance.
        Claims increase: Auto claims typically 40% higher during peak rainy months.`,
        metadata: {
          type: 'market_context',
          category: 'seasonal',
          subcategory: 'rainy_season',
          region: 'ghana',
          priority: 'medium',
          companyId: 'generic'
        }
      },

      // BUSINESS INSURANCE
      {
        id: 'gh_business_insurance_sme',
        content: `Small and Medium Enterprise (SME) Insurance in Ghana:
        Essential coverage: Public liability, professional indemnity, fire and special perils, business interruption.
        Sector-specific: Retail shops, restaurants, manufacturing, trading, services each have unique needs.
        Premium factors: Business type, location, annual turnover, number of employees, risk profile.
        Typical costs: SMEs pay 0.2-1% of annual turnover for comprehensive business insurance.
        Popular add-ons: Electronic equipment, goods in transit, key person insurance, cyber liability.
        Regulatory requirements: Some businesses required by law to have minimum insurance coverage.
        Claims support: Business interruption insurance crucial for cash flow protection.`,
        metadata: {
          type: 'product',
          category: 'business_insurance',
          subcategory: 'sme',
          region: 'ghana',
          priority: 'medium',
          companyId: 'generic'
        }
      },

      // OBJECTION HANDLING
      {
        id: 'gh_objections_price_too_high',
        content: `Handling "Insurance is Too Expensive" Objection in Ghana:
        Acknowledge concern: "I understand that budget is important for every Ghanaian family."
        Cost comparison: Compare daily cost to small expenses (GHS 2/day = GHS 730/year for auto insurance).
        Value demonstration: Calculate potential loss vs. premium cost (car worth GHS 50,000 vs GHS 2,000 premium).
        Payment options: Monthly installments, mobile money convenience, salary deduction available.
        Discounts available: No-claims bonus, family policies, loyalty discounts, group insurance rates.
        Risk scenarios: Hospital bills (GHS 10,000+), car replacement cost, family income protection.
        Local examples: Share stories of how insurance helped other Ghanaians in similar situations.`,
        metadata: {
          type: 'objection',
          category: 'price',
          region: 'ghana',
          priority: 'high',
          companyId: 'generic'
        }
      },
      {
        id: 'gh_objections_dont_need_insurance',
        content: `Handling "I Don't Need Insurance" Objection in Ghana:
        Empathy approach: "Many successful Ghanaians felt the same way until they experienced an unexpected event."
        Risk awareness: Accra traffic accidents (15,000+ annually), medical emergencies, property damage from storms.
        Financial protection: Preserve savings and investments from unexpected large expenses.
        Legal requirements: Auto insurance mandatory, some business insurance required by law.
        Family responsibility: Protect family's financial future, children's education fund, spouse's security.
        Success stories: Share examples of how insurance protected local families and businesses.
        Peace of mind: Sleep better knowing you're protected against life's uncertainties.`,
        metadata: {
          type: 'objection',
          category: 'necessity',
          region: 'ghana',
          priority: 'high',
          companyId: 'generic'
        }
      }
    ];
  }

  private async testKnowledgeSearch(vectorStore: any): Promise<void> {
    console.log('🔍 Testing knowledge search with populated data...');
    
    const testQueries = [
      'auto insurance premium calculation Ghana',
      'MTN MoMo payment insurance',
      'health insurance NHIS private',
      'claims process accident',
      'Twi language insurance',
      'harmattan season vehicle protection'
    ];

    for (const query of testQueries) {
      try {
        const results = await vectorStore.searchByText(query, 3);
        if (results.length > 0) {
          console.log(`✅ "${query}": ${results.length} results (score: ${results[0].score.toFixed(3)})`);
        } else {
          console.log(`⚠️  "${query}": No results found`);
        }
      } catch (error) {
        console.error(`❌ Test query "${query}" failed:`, error);
      }
    }
  }
}

// Run population if called directly
if (require.main === module) {
  const populator = new KnowledgeBasePopulator();
  
  populator.populate()
    .then(() => {
      console.log('🎉 Knowledge base population completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Knowledge base population failed:', error);
      process.exit(1);
    });
}