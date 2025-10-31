import { log } from "./vite";

interface BulkDeleteResponse {
  success: boolean;
  batchId?: string;
  deletedCount?: number;
  failedCount?: number;
  errors?: string[];
}

interface CleanupResult {
  totalProcessed: number;
  totalDeleted: number;
  totalFailed: number;
  batches: number;
  errors: string[];
  dryRun: boolean;
}

export class PendoCleanupService {
  private integrationKey: string;
  private apiBaseUrl = 'https://app.pendo.io/api/v1';
  private batchSize = 100; // Pendo API limit
  private delayBetweenBatches = 1000; // 1 second delay for rate limiting

  constructor() {
    this.integrationKey = process.env.PENDO_INTEGRATION_KEY || '';
    
    if (!this.integrationKey) {
      log("Warning: PENDO_INTEGRATION_KEY not configured - cleanup disabled");
    }
  }

  /**
   * Delete a batch of visitors using Pendo's bulk delete API
   */
  private async deleteBatch(visitorIds: string[]): Promise<BulkDeleteResponse> {
    if (!this.integrationKey) {
      throw new Error('Pendo Integration Key not configured');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/bulkdelete/visitor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pendo-integration-key': this.integrationKey
        },
        body: JSON.stringify({
          visitors: visitorIds
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        log(`Pendo bulk delete failed: ${response.status} - ${errorText}`);
        return {
          success: false,
          deletedCount: 0,
          failedCount: visitorIds.length,
          errors: [`HTTP ${response.status}: ${errorText}`]
        };
      }

      const data = await response.json();
      log(`Pendo bulk delete batch successful:`, data);
      
      return {
        success: true,
        batchId: data.batchId,
        deletedCount: visitorIds.length,
        failedCount: 0,
        errors: []
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log('Pendo bulk delete error:', errorMsg);
      return {
        success: false,
        deletedCount: 0,
        failedCount: visitorIds.length,
        errors: [errorMsg]
      };
    }
  }

  /**
   * Sleep utility for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up anonymous Pendo visitors in batches
   * @param visitorIds Array of visitor IDs to delete
   * @param dryRun If true, only simulate the deletion without actually calling the API
   */
  async cleanupAnonymousVisitors(
    visitorIds: string[],
    dryRun: boolean = true
  ): Promise<CleanupResult> {
    log(`Starting Pendo cleanup - ${dryRun ? 'DRY RUN' : 'LIVE'} mode`);
    log(`Total visitors to process: ${visitorIds.length}`);

    const result: CleanupResult = {
      totalProcessed: 0,
      totalDeleted: 0,
      totalFailed: 0,
      batches: 0,
      errors: [],
      dryRun
    };

    // Split into batches of 100
    const batches: string[][] = [];
    for (let i = 0; i < visitorIds.length; i += this.batchSize) {
      batches.push(visitorIds.slice(i, i + this.batchSize));
    }

    log(`Processing ${batches.length} batches of up to ${this.batchSize} visitors each`);

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      result.batches++;
      
      log(`Processing batch ${i + 1}/${batches.length} (${batch.length} visitors)`);

      if (dryRun) {
        // Simulate success in dry run mode
        result.totalProcessed += batch.length;
        result.totalDeleted += batch.length;
        log(`[DRY RUN] Would delete ${batch.length} visitors in this batch`);
      } else {
        // Actually delete the batch
        const batchResult = await this.deleteBatch(batch);
        
        result.totalProcessed += batch.length;
        result.totalDeleted += batchResult.deletedCount || 0;
        result.totalFailed += batchResult.failedCount || 0;
        
        if (batchResult.errors && batchResult.errors.length > 0) {
          result.errors.push(...batchResult.errors.map(e => String(e)));
        }

        if (!batchResult.success) {
          log(`Batch ${i + 1} failed:`, batchResult.errors);
        }
      }

      // Rate limiting: wait between batches (except for the last one)
      if (i < batches.length - 1) {
        await this.sleep(this.delayBetweenBatches);
      }
    }

    log(`Cleanup complete - Processed: ${result.totalProcessed}, Deleted: ${result.totalDeleted}, Failed: ${result.totalFailed}`);
    
    return result;
  }

  /**
   * Parse visitor IDs from CSV content and filter for anonymous visitors
   */
  parseAnonymousVisitorsFromCSV(csvContent: string): string[] {
    const lines = csvContent.split('\n');
    const anonymousVisitors: string[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Extract first column (visitor ID)
      // Handle quoted values that might contain commas
      let visitorId = '';
      if (line.startsWith('"')) {
        const endQuote = line.indexOf('"', 1);
        visitorId = line.substring(1, endQuote).trim();
      } else {
        visitorId = line.split(',')[0].trim();
      }

      // Filter for anonymous visitors
      if (visitorId.startsWith('anonymous-')) {
        anonymousVisitors.push(visitorId);
      }
    }

    log(`Parsed ${anonymousVisitors.length} anonymous visitors from CSV`);
    return anonymousVisitors;
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!this.integrationKey;
  }
}

// Export singleton instance
export const pendoCleanupService = new PendoCleanupService();
