import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SourcingQueryDto, SourcingResultDto } from './dto/sourcing.dto';

@Injectable()
export class SourcingService {
  constructor(private configService: ConfigService) {}

  async researchSuppliers(query: SourcingQueryDto): Promise<SourcingResultDto> {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new HttpException(
        'Anthropic API key is not configured.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const systemPrompt = `You are a sports equipment sourcing agent for Kora, a brand selling 
FIFA-quality footballs and IHF-quality handballs, focused on the Egyptian market.

When given a sourcing requirement, use web search to find real manufacturers.
Prioritise suppliers from Pakistan (Sialkot), China (Yangzhou/Dongguan), and Vietnam.

Evaluate each supplier against these criteria:
- Cover material: PU preferred over PVC; microfiber for match grade
- Bladder: latex for match/competition, butyl acceptable for training/club
- Stitching: hand-stitched for Match Pro, machine-stitched acceptable for lower tiers
- Certifications: IHF approval, FIFA Quality Pro/Basic, EN 71-1 — note which each supplier holds
- MOQ: flag anything above the user's stated maximum
- Payment: note if they accept Payoneer, T/T (wire), or LC

Return ONLY valid JSON with no markdown fencing, no preamble, matching exactly this structure:
{
  "suppliers": [
    {
      "name": "",
      "country": "",
      "tierFit": "",
      "coverMaterial": "",
      "bladder": "",
      "stitching": "",
      "certifications": [],
      "estimatedMoq": "",
      "estimatedFobPrice": "",
      "paymentMethods": [],
      "contactInfo": "",
      "notes": "",
      "score": 0
    }
  ],
  "recommended": "",
  "reasoning": "",
  "contactEmailDraft": ""
}

The contactEmailDraft should be a professional English email from Kora 
introducing themselves as a sports brand based in Germany supplying the 
Egyptian market, requesting a product catalogue, pricing sheet, and sample terms.`;

    const userMessage = `Sourcing Query:
Sport: ${query.sport}
Tier: ${query.tier}
${query.certifications?.length ? `Required Certifications: ${query.certifications.join(', ')}` : ''}
Target Market: ${query.targetMarket || 'Egypt'}
Budget Per Unit: ${query.budgetPerUnit || 'N/A'}
Max MOQ: ${query.moqMax || 'N/A'}
${query.notes ? `Additional Notes: ${query.notes}` : ''}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'web-search-2025-03-05',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userMessage,
            },
          ],
          tools: [
            {
              type: 'web_search_20250305',
              name: 'web_search',
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new HttpException(
          `Anthropic API error: ${response.status} - ${errText}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const resData = await response.json();
      const textContent = resData.content?.find((c: any) => c.type === 'text')?.text || '';

      // Clean markdown code blocks if the model wrapped it despite instructions
      let cleanedJson = textContent.trim();
      if (cleanedJson.startsWith('```')) {
        cleanedJson = cleanedJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }

      try {
        const parsed = JSON.parse(cleanedJson);
        return parsed as SourcingResultDto;
      } catch (err) {
        throw new HttpException(
          `Failed to parse supplier JSON from Claude response. Raw response: ${cleanedJson}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to complete sourcing research: ${error.message || error}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
