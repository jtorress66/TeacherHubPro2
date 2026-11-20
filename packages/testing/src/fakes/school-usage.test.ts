import { schoolUsageReportContract } from '../contracts/school-usage.contract.ts';
import { InMemorySchoolUsageReport } from './school-usage.ts';

schoolUsageReportContract('InMemorySchoolUsageReport', () => {
  const report = new InMemorySchoolUsageReport();
  return Promise.resolve({ report, seed: (data) => report.seed(data) });
});
