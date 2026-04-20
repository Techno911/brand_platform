import { Injectable } from '@nestjs/common';

/**
 * Post-MVP: Causal Impact (Google) — measurable lift of BP intervention.
 * Stub surface: compute pre/post metrics, return lift estimate.
 * Real implementation requires 20+ completed projects (INSIGHTS §11).
 */
@Injectable()
export class CausalImpactService {
  estimate(
    _preTreatment: number[],
    _postTreatment: number[],
    _preControl: number[],
    _postControl: number[],
  ): { enabled: false; reason: string } {
    return { enabled: false, reason: 'requires 20+ projects; enabled after MVP phase' };
  }
}
