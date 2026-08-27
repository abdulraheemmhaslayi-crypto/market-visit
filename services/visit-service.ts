import pool from '@/lib/db';
import { visitRepository } from '@/repositories/visit-repository';
import { Visit, VisitPhoto, NPDResponse, VisitAsset, VisitPowerSkuResult } from '@/types';

export const visitService = {
  async saveVisit(
    visit: Visit,
    assets: VisitAsset[],
    photos: VisitPhoto[],
    powerSkuResults: VisitPowerSkuResult[],
    npdResponses: NPDResponse[]
  ): Promise<Visit> {
    return await visitRepository.saveVisit(visit, assets, photos, powerSkuResults, npdResponses);
  },

  async deleteVisit(visitId: string): Promise<void> {
    await visitRepository.deleteVisit(visitId);
  }
};
