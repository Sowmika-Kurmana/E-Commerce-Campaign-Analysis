/**
 * E-Commerce Campaign Analysis & A/B Testing Dashboard
 * Author: Sowmika Kurmana (ANITS - IBM Q2D Internship)
 * 
 * Features:
 * - Strict source-of-truth default data
 * - Dynamic Two-Proportion Z-Test engine
 * - Fully Dynamic Gaussian Normal Distribution visualizer
 * - Dynamic Executive Overview, Decision Cards, Timeline & Presentation Mode
 * - Real-time CSV parser, validator, and data cleaner
 */

// --- 1. DEFAULT PROJECT SOURCE OF TRUTH DATA ---
const DEFAULT_METRICS = {
  rawRecords: 294478,
  initialDuplicates: 3894,
  controlNewMismatch: 1928,
  treatmentOldMismatch: 1965,
  invalidAssignmentsRemoved: 3893,
  afterMismatchRemoved: 290585,
  dedupedUsersCount: 1, // User ID 773192
  finalCleanedRecords: 290584,
  remainingDuplicates: 0,
  missingValues: 0,
  
  controlUsers: 145274,
  controlConversions: 17489,
  controlConversionRate: 0.1203863, // 12.04%
  
  treatmentUsers: 145311,
  treatmentConversions: 17264,
  treatmentConversionRate: 0.1188072, // 11.88%
  
  relativeLift: -1.3115, // -1.31%
  crDifference: -0.001579, // -0.158 percentage points
  
  pooledProportion: 0.119597, // 11.96%
  standardError: 0.0012038,
  zStatistic: -1.3109, // approx -1.312
  pValue: 0.18965,
  alpha: 0.05,
  decision: "FAIL TO REJECT H₀",
  isSignificant: false
};

// Global state
let currentMetrics = { ...DEFAULT_METRICS };
let conversionRateChartInstance = null;
let stackedConversionChartInstance = null;

// --- 2. STATISTICAL UTILITIES ---

/**
 * Standard Normal Cumulative Distribution Function (Abramowitz & Stegun approximation)
 * Precision ~ 1e-7
 */
function standardNormalCDF(z) {
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.3989422804014327; // 1 / sqrt(2*pi)
  
  if (z >= 0) {
    const t = 1.0 / (1.0 + p * z);
    return 1.0 - c * Math.exp(-z * z / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  } else {
    const t = 1.0 / (1.0 - p * z);
    return c * Math.exp(-z * z / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  }
}

/**
 * Standard Normal Probability Density Function (PDF)
 */
function standardNormalPDF(z) {
  return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z);
}

/**
 * Computes Two-Proportion Z-Test statistics
 */
function computeTwoProportionZTest(controlUsers, controlConversions, treatmentUsers, treatmentConversions, alpha = 0.05) {
  const p1 = controlConversions / controlUsers;
  const p2 = treatmentConversions / treatmentUsers;
  const pooledP = (controlConversions + treatmentConversions) / (controlUsers + treatmentUsers);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / controlUsers + 1 / treatmentUsers));
  const z = (p2 - p1) / se;
  
  // Two-sided p-value
  let pValue = 2 * (1 - standardNormalCDF(Math.abs(z)));
  if (pValue < 0) pValue = 0;
  
  const isSignificant = pValue < alpha;
  const decision = isSignificant ? "REJECT H₀" : "FAIL TO REJECT H₀";
  const relativeLift = ((p2 - p1) / p1) * 100;
  const crDiff = (p2 - p1) * 100;

  return {
    controlUsers,
    controlConversions,
    controlConversionRate: p1,
    treatmentUsers,
    treatmentConversions,
    treatmentConversionRate: p2,
    pooledProportion: pooledP,
    standardError: se,
    zStatistic: z,
    pValue: pValue,
    alpha: alpha,
    decision: decision,
    isSignificant: isSignificant,
    relativeLift: relativeLift,
    crDifference: crDiff / 100
  };
}

// --- 3. FORMATTING HELPERS ---

function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(Math.round(num));
}

function formatPercent(num, decimals = 2) {
  return (num * 100).toFixed(decimals) + '%';
}

function formatPValue(p) {
  if (p < 0.00001) {
    return "< 0.00001";
  }
  return p.toFixed(5);
}

// --- 4. UI RENDERING & DOM UPDATES ---

function updateDashboardUI(metrics) {
  const isSig = metrics.isSignificant;
  const isTreatmentBetter = metrics.treatmentConversionRate > metrics.controlConversionRate;
  const isTreatmentWorse = metrics.treatmentConversionRate < metrics.controlConversionRate;
  
  const liftVal = metrics.relativeLift;
  const liftStr = (liftVal >= 0 ? '+' : '') + liftVal.toFixed(2) + '%';
  const diffPoints = (metrics.crDifference * 100).toFixed(3);
  const diffPointsStr = `${diffPoints >= 0 ? '+' : ''}${diffPoints}% points`;
  const zStr = (metrics.zStatistic >= 0 ? '+' : '') + metrics.zStatistic.toFixed(3);
  const pValFormatted = formatPValue(metrics.pValue);

  // 1. Dataset Status Badges in Header & Banner
  const statusBadge = document.getElementById('dataset-status-badge');
  const statusText = document.getElementById('dataset-status-text');
  if (statusBadge && statusText) {
    statusBadge.classList.remove('hidden');
    statusText.innerText = `Dataset: ${formatNumber(metrics.finalCleanedRecords)} Cleaned Rows`;
  }

  // 2. Executive Overview KPIs (Fixes 17,489 / 17,264 hardcoding)
  document.getElementById('kpi-total-users').innerText = formatNumber(metrics.finalCleanedRecords);
  document.getElementById('kpi-control-users').innerText = formatNumber(metrics.controlUsers);
  document.getElementById('kpi-treatment-users').innerText = formatNumber(metrics.treatmentUsers);
  document.getElementById('kpi-control-cr').innerText = formatPercent(metrics.controlConversionRate);
  document.getElementById('kpi-treatment-cr').innerText = formatPercent(metrics.treatmentConversionRate);
  
  // Executive Overview Conversion Counts (DYNAMIC)
  document.getElementById('kpi-control-conv-count').innerText = `${formatNumber(metrics.controlConversions)} conversions`;
  document.getElementById('kpi-treatment-conv-count').innerText = `${formatNumber(metrics.treatmentConversions)} conversions`;
  
  document.getElementById('kpi-relative-lift').innerText = liftStr;
  document.getElementById('kpi-cr-diff').innerText = diffPointsStr;
  
  // Update KPI card styles depending on lift sign
  const liftCard = document.getElementById('kpi-relative-lift');
  if (liftVal >= 0) {
    liftCard.className = "text-xl font-extrabold text-emerald-700 font-mono tracking-tight";
    document.getElementById('kpi-lift-icon-container').className = "w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center";
  } else {
    liftCard.className = "text-xl font-extrabold text-amber-700 font-mono tracking-tight";
    document.getElementById('kpi-lift-icon-container').className = "w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center";
  }

  // Treatment trend icon
  const treatIcon = document.getElementById('kpi-treatment-trend-icon');
  if (treatIcon) {
    treatIcon.setAttribute('data-lucide', isTreatmentBetter ? 'trending-up' : 'trending-down');
  }

  // Overview Specification Result
  document.getElementById('overview-spec-result').innerText = metrics.decision;
  document.getElementById('overview-spec-result').className = isSig ? "text-emerald-400 font-bold" : "text-amber-400 font-bold";

  // 3. Data Quality Section
  document.getElementById('dq-raw-records').innerText = formatNumber(metrics.rawRecords);
  document.getElementById('dq-dup-users').innerText = formatNumber(metrics.initialDuplicates);
  document.getElementById('dq-invalid-removed').innerText = (metrics.invalidAssignmentsRemoved > 0 ? '-' : '') + formatNumber(metrics.invalidAssignmentsRemoved);
  document.getElementById('dq-dedup-user').innerText = (metrics.dedupedUsersCount > 0 ? '-' : '') + formatNumber(metrics.dedupedUsersCount);
  document.getElementById('dq-final-records').innerText = formatNumber(metrics.finalCleanedRecords);

  const dedupLabel = document.getElementById('dq-dedup-label');
  if (dedupLabel) {
    dedupLabel.innerText = metrics.dedupedUsersCount > 0 ? `${metrics.dedupedUsersCount} duplicates deduped` : 'No residual duplicates';
  }

  // Table
  document.getElementById('table-raw-records').innerText = formatNumber(metrics.rawRecords);
  document.getElementById('table-dup-ids').innerText = formatNumber(metrics.initialDuplicates);
  document.getElementById('table-invalid-removed').innerText = formatNumber(metrics.invalidAssignmentsRemoved);
  document.getElementById('table-final-records').innerText = formatNumber(metrics.finalCleanedRecords);
  document.getElementById('table-remaining-dups').innerText = formatNumber(metrics.remainingDuplicates);
  document.getElementById('table-missing-vals').innerText = formatNumber(metrics.missingValues);

  // Mismatches
  document.getElementById('mismatch-control-new').innerText = formatNumber(metrics.controlNewMismatch) + ' rows';
  document.getElementById('mismatch-treatment-old').innerText = formatNumber(metrics.treatmentOldMismatch) + ' rows';
  const mismatchPercent = metrics.rawRecords > 0 ? ((metrics.invalidAssignmentsRemoved / metrics.rawRecords) * 100).toFixed(2) : '0.00';
  document.getElementById('mismatch-total').innerText = `${formatNumber(metrics.invalidAssignmentsRemoved)} Rows (${mismatchPercent}%)`;

  // 4. Experiment Analysis Section
  document.getElementById('exp-control-users').innerText = formatNumber(metrics.controlUsers);
  document.getElementById('exp-control-convs').innerText = formatNumber(metrics.controlConversions);
  document.getElementById('exp-control-cr').innerText = formatPercent(metrics.controlConversionRate);
  const controlNonConv = metrics.controlUsers - metrics.controlConversions;
  const controlNonConvPct = metrics.controlUsers > 0 ? ((controlNonConv / metrics.controlUsers) * 100).toFixed(2) : '0.00';
  document.getElementById('exp-control-nonconv').innerText = `${formatNumber(controlNonConv)} (${controlNonConvPct}%)`;
  const controlSplit = metrics.finalCleanedRecords > 0 ? ((metrics.controlUsers / metrics.finalCleanedRecords) * 100).toFixed(2) : '50.00';
  document.getElementById('exp-control-split').innerText = `${controlSplit}%`;

  document.getElementById('exp-treatment-users').innerText = formatNumber(metrics.treatmentUsers);
  document.getElementById('exp-treatment-convs').innerText = formatNumber(metrics.treatmentConversions);
  document.getElementById('exp-treatment-cr').innerText = formatPercent(metrics.treatmentConversionRate);
  const treatmentNonConv = metrics.treatmentUsers - metrics.treatmentConversions;
  const treatmentNonConvPct = metrics.treatmentUsers > 0 ? ((treatmentNonConv / metrics.treatmentUsers) * 100).toFixed(2) : '0.00';
  document.getElementById('exp-treatment-nonconv').innerText = `${formatNumber(treatmentNonConv)} (${treatmentNonConvPct}%)`;
  const treatmentSplit = metrics.finalCleanedRecords > 0 ? ((metrics.treatmentUsers / metrics.finalCleanedRecords) * 100).toFixed(2) : '50.00';
  document.getElementById('exp-treatment-split').innerText = `${treatmentSplit}%`;

  // 5. Conversion Analysis Delta & Context
  document.getElementById('delta-points').innerText = diffPointsStr;
  document.getElementById('delta-lift').innerText = liftStr;
  document.getElementById('delta-formula').innerText = `(${formatPercent(metrics.treatmentConversionRate)} - ${formatPercent(metrics.controlConversionRate)}) / ${formatPercent(metrics.controlConversionRate)}`;
  
  const deltaIconBox = document.getElementById('delta-icon-box');
  if (deltaIconBox) {
    deltaIconBox.className = liftVal >= 0 ? "w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold" : "w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold";
  }

  // Dynamic Context Alert Note
  const contextText = document.getElementById('conversion-context-text');
  if (contextText) {
    if (isTreatmentBetter && isSig) {
      contextText.innerHTML = `<strong>Analytical Context:</strong> "The Treatment group shows a significantly higher conversion rate than Control (${formatPercent(metrics.treatmentConversionRate)} vs ${formatPercent(metrics.controlConversionRate)}), representing a statistically verified positive lift of ${liftStr}."`;
    } else if (isTreatmentWorse && isSig) {
      contextText.innerHTML = `<strong>Analytical Context:</strong> "The Treatment group shows a significantly lower conversion rate than Control (${formatPercent(metrics.treatmentConversionRate)} vs ${formatPercent(metrics.controlConversionRate)}), representing a statistically verified drop in conversions."`;
    } else {
      contextText.innerHTML = `<strong>Analytical Context:</strong> "The Treatment group shows a slightly ${isTreatmentBetter ? 'higher' : 'lower'} observed conversion rate than Control (${formatPercent(metrics.treatmentConversionRate)} vs ${formatPercent(metrics.controlConversionRate)}), but this observed difference must be tested statistically before making a business decision."`;
    }
  }

  const chartSub = document.getElementById('chart-cr-subtitle');
  if (chartSub) {
    chartSub.innerText = `Control (${formatPercent(metrics.controlConversionRate)}) vs Treatment (${formatPercent(metrics.treatmentConversionRate)})`;
  }

  // 6. Statistical Test Section
  document.getElementById('stat-decision-badge').innerText = metrics.decision;
  document.getElementById('stat-z-stat').innerText = zStr;
  document.getElementById('stat-p-val').innerText = pValFormatted;
  document.getElementById('stat-p-pool').innerText = formatPercent(metrics.pooledProportion);
  document.getElementById('stat-se-desc').innerText = `SE ≈ ${metrics.standardError.toFixed(6)}`;

  // Z-Zone description
  const zZoneEl = document.getElementById('stat-z-zone');
  if (zZoneEl) {
    if (Math.abs(metrics.zStatistic) >= 1.96) {
      zZoneEl.innerText = `Critical Rejection Region (|z| ≥ 1.96)`;
      zZoneEl.className = "text-[10px] text-emerald-600 font-semibold";
    } else {
      zZoneEl.innerText = `Inside fail-to-reject zone`;
      zZoneEl.className = "text-[10px] text-slate-500";
    }
  }

  // P-comparison
  const pCompEl = document.getElementById('stat-p-comp');
  if (pCompEl) {
    if (isSig) {
      pCompEl.innerText = `p-value (${pValFormatted}) < α (0.05)`;
      pCompEl.className = "text-[10px] text-emerald-600 font-bold";
    } else {
      pCompEl.innerText = `p-value (${pValFormatted}) > α (0.05)`;
      pCompEl.className = "text-[10px] text-indigo-600 font-medium";
    }
  }

  // Status Badge in Header of Section 5
  const statStatusBadge = document.getElementById('stat-status-badge');
  const statStatusContainer = document.getElementById('stat-status-container');
  const statDecisionIcon = document.getElementById('stat-decision-icon');
  
  if (statStatusBadge && statStatusContainer) {
    if (isSig) {
      statStatusBadge.innerText = "STATISTICALLY SIGNIFICANT";
      statStatusBadge.className = "text-[10px] uppercase tracking-wider font-bold text-emerald-700 block";
      statStatusContainer.className = "flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-sm";
      if (statDecisionIcon) {
        statDecisionIcon.className = "w-5 h-5 text-emerald-600";
        statDecisionIcon.setAttribute('data-lucide', 'check-circle');
      }
    } else {
      statStatusBadge.innerText = "NOT STATISTICALLY SIGNIFICANT";
      statStatusBadge.className = "text-[10px] uppercase tracking-wider font-bold text-amber-700 block";
      statStatusContainer.className = "flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 shadow-sm";
      if (statDecisionIcon) {
        statDecisionIcon.className = "w-5 h-5 text-amber-600";
        statDecisionIcon.setAttribute('data-lucide', 'alert-octagon');
      }
    }
  }

  // Gaussian Normal Chart Text (DYNAMIC)
  document.getElementById('gaussian-subtitle').innerText = `Visualizing critical rejection thresholds (±1.96) versus observed test statistic (z = ${zStr}).`;
  document.getElementById('gaussian-p-legend').innerText = `p-value Area (${pValFormatted})`;
  
  const gaussianSummary = document.getElementById('gaussian-z-summary');
  const gaussianBadge = document.getElementById('gaussian-status-badge');
  
  if (metrics.zStatistic >= 1.96) {
    gaussianSummary.innerText = `Observed z = ${zStr} falls in the RIGHT REJECTION REGION (z > +1.96)`;
    gaussianBadge.innerText = "STATUS: STATISTICALLY SIGNIFICANT (REJECT H₀)";
    gaussianBadge.className = "text-emerald-400 font-bold";
  } else if (metrics.zStatistic <= -1.96) {
    gaussianSummary.innerText = `Observed z = ${zStr} falls in the LEFT REJECTION REGION (z < -1.96)`;
    gaussianBadge.innerText = "STATUS: STATISTICALLY SIGNIFICANT (REJECT H₀)";
    gaussianBadge.className = "text-rose-400 font-bold";
  } else {
    gaussianSummary.innerText = `Observed z = ${zStr} lies between -1.96 and +1.96`;
    gaussianBadge.innerText = "STATUS: NOT STATISTICALLY SIGNIFICANT (FAIL TO REJECT H₀)";
    gaussianBadge.className = "text-amber-400 font-bold";
  }

  // Statistical Interpretation Callouts
  const interpMain = document.getElementById('stat-interp-main');
  const interpFormal = document.getElementById('stat-interp-formal');
  const interpNote = document.getElementById('stat-interp-note');

  if (interpMain && interpFormal && interpNote) {
    if (isTreatmentBetter && isSig) {
      interpMain.innerText = `"The observed difference in conversion rates is statistically significant at the 5% significance level (p < 0.05)."`;
      interpFormal.innerText = `"The experiment provides statistically significant evidence that the Treatment landing page improved customer conversion performance compared to Control."`;
      interpNote.innerText = `Because the test statistic (z = ${zStr}) falls in the critical rejection region, we reject the null hypothesis H₀ in favor of the alternative hypothesis H₁.`;
    } else if (isTreatmentWorse && isSig) {
      interpMain.innerText = `"The observed difference in conversion rates is statistically significant at the 5% significance level (p < 0.05).`;
      interpFormal.innerText = `"The experiment provides statistically significant evidence that the Treatment landing page produced a lower conversion rate compared to Control."`;
      interpNote.innerText = `Because the test statistic (z = ${zStr}) falls in the critical rejection region, we reject the null hypothesis H₀ and conclude that Treatment significantly underperformed.`;
    } else {
      interpMain.innerText = `"The observed difference in conversion rates is not statistically significant at the 5% significance level."`;
      interpFormal.innerText = `"The experiment does not provide sufficient statistical evidence that the Treatment landing page changed conversion performance."`;
      interpNote.innerText = `Note: We do NOT claim that the Treatment landing page is definitively worse or that the redesign failed. We simply fail to reject the null hypothesis due to lack of evidence beyond natural variance.`;
    }
  }

  // 7. Business Recommendation Section (DYNAMIC RECOMMENDATION LOGIC)
  const recHeadline = document.getElementById('rec-headline');
  const recSubhead = document.getElementById('rec-subhead');
  const recCard1Title = document.getElementById('rec-card-1-title');
  const recCard1Desc = document.getElementById('rec-card-1-desc');
  const recCard2Title = document.getElementById('rec-card-2-title');
  const recCard2Desc = document.getElementById('rec-card-2-desc');
  const recCard3Title = document.getElementById('rec-card-3-title');
  const recCard3Desc = document.getElementById('rec-card-3-desc');
  const recCard4Title = document.getElementById('rec-card-4-title');
  const recCard4Desc = document.getElementById('rec-card-4-desc');

  if (recHeadline && recSubhead) {
    if (isTreatmentBetter && isSig) {
      // CASE A: Treatment > Control & p < alpha
      recHeadline.innerText = "CONSIDER ADOPTING THE TREATMENT LANDING PAGE";
      recSubhead.innerText = `The Treatment landing page achieved a higher conversion rate than Control (${formatPercent(metrics.treatmentConversionRate)} vs ${formatPercent(metrics.controlConversionRate)}). The difference is statistically significant at α = 0.05, with z ≈ ${metrics.zStatistic.toFixed(3)} and p ${pValFormatted}.`;
      
      recCard1Title.innerText = "Higher Observed Conversion Rate";
      recCard1Desc.innerText = `Treatment achieved ${formatPercent(metrics.treatmentConversionRate)} compared to Control at ${formatPercent(metrics.controlConversionRate)} (Lift: +${metrics.relativeLift.toFixed(2)}%).`;
      
      recCard2Title.innerText = "Statistically Significant Lift";
      recCard2Desc.innerText = `The observed difference (+${(metrics.crDifference * 100).toFixed(2)}% points) provides strong evidence that the new page outperforms the old page.`;
      
      recCard3Title.innerText = "p-value < 0.05 Threshold";
      recCard3Desc.innerText = `Test p-value of ${pValFormatted} is below the 5% decision threshold (α = 0.05), confirming the result is unlikely due to random variation.`;
      
      recCard4Title.innerText = "Adoption & Rollout";
      recCard4Desc.innerText = `Consider adopting the Treatment variant because the experiment provides statistically significant evidence of improved conversion.`;
    } else if (isTreatmentWorse && isSig) {
      // CASE B: Treatment < Control & p < alpha
      recHeadline.innerText = "RETAIN THE CONTROL LANDING PAGE";
      recSubhead.innerText = `The Treatment landing page resulted in a statistically significant decrease in conversion rate (${formatPercent(metrics.treatmentConversionRate)} vs ${formatPercent(metrics.controlConversionRate)} at α = 0.05).`;
      
      recCard1Title.innerText = "Lower Observed Conversion Rate";
      recCard1Desc.innerText = `Treatment conversion was ${formatPercent(metrics.treatmentConversionRate)} compared to Control at ${formatPercent(metrics.controlConversionRate)} (Lift: ${metrics.relativeLift.toFixed(2)}%).`;
      
      recCard2Title.innerText = "Statistically Significant Drop";
      recCard2Desc.innerText = `The observed difference (${(metrics.crDifference * 100).toFixed(2)}% points) demonstrates a statistically significant decline in conversion.`;
      
      recCard3Title.innerText = "p-value < 0.05 Threshold";
      recCard3Desc.innerText = `Test p-value of ${pValFormatted} is below α = 0.05, confirming the reduction in conversion is statistically significant.`;
      
      recCard4Title.innerText = "Retain Baseline & Redesign";
      recCard4Desc.innerText = `Retain the Control variant because the Treatment variant produced a statistically significant decrease in conversion.`;
    } else {
      // CASE C: p >= alpha
      recHeadline.innerText = "RETAIN THE EXISTING LANDING PAGE FOR NOW";
      recSubhead.innerText = `The experiment does not provide sufficient statistical evidence of a difference. Further experimentation is recommended.`;
      
      recCard1Title.innerText = "Slightly Lower Observed Rate";
      recCard1Desc.innerText = `Treatment conversion was ${formatPercent(metrics.treatmentConversionRate)} compared to Control at ${formatPercent(metrics.controlConversionRate)}.`;
      
      recCard2Title.innerText = "No Statistical Significance";
      recCard2Desc.innerText = `Observed difference (${diffPointsStr}) could arise entirely from random variance.`;
      
      recCard3Title.innerText = "p-value > 0.05 Threshold";
      recCard3Desc.innerText = `Test p-value of ${pValFormatted} exceeds the 5% decision threshold (α = 0.05).`;
      
      recCard4Title.innerText = "Iterative Experimentation";
      recCard4Desc.innerText = `The experiment does not provide sufficient statistical evidence of a difference. Further experimentation is recommended.`;
    }
  }

  // 8. End-to-End Timeline Steps
  const tStep2 = document.getElementById('timeline-step-2-desc');
  const tStep3 = document.getElementById('timeline-step-3-desc');
  const tStep4 = document.getElementById('timeline-step-4-desc');
  const tStep5 = document.getElementById('timeline-step-5-desc');
  const tStep6 = document.getElementById('timeline-step-6-desc');
  const tStep7 = document.getElementById('timeline-step-7-desc');

  if (tStep2) tStep2.innerText = `Collect ${formatNumber(metrics.rawRecords)} raw user interaction logs across experiment groups, landing pages, and conversion outcomes.`;
  if (tStep3) tStep3.innerText = `Audit ${formatNumber(metrics.initialDuplicates)} duplicate IDs, remove ${formatNumber(metrics.invalidAssignmentsRemoved)} invalid cross-assignments &rarr; ${formatNumber(metrics.finalCleanedRecords)} verified records.`;
  if (tStep4) tStep4.innerText = `Analyze user distributions (Control ${formatNumber(metrics.controlUsers)} vs Treatment ${formatNumber(metrics.treatmentUsers)}), compute conversion rates (${formatPercent(metrics.controlConversionRate)} vs ${formatPercent(metrics.treatmentConversionRate)}) and relative lift (${liftStr}).`;
  if (tStep5) tStep5.innerText = `Formulate hypotheses at α = 0.05, compute pooled proportion (${formatPercent(metrics.pooledProportion)}) and two-proportion z-statistic (z = ${zStr}).`;
  if (tStep6) tStep6.innerText = `Compare two-tailed p-value (${pValFormatted}) against α = 0.05 &rarr; ${metrics.decision} (${isSig ? 'Statistically Significant' : 'Not Statistically Significant'}).`;
  if (tStep7) {
    if (isTreatmentBetter && isSig) {
      tStep7.innerText = `Recommend adopting the Treatment landing page based on statistically verified conversion rate improvement.`;
    } else if (isTreatmentWorse && isSig) {
      tStep7.innerText = `Recommend retaining the Control landing page to prevent statistically significant conversion losses.`;
    } else {
      tStep7.innerText = `Recommend retaining existing landing page, preventing premature migration, and formulating new multivariate experiment hypotheses.`;
    }
  }

  // 9. Future Experiments Confidence Interval (Card 5)
  const futureCIDesc = document.getElementById('future-ci-desc');
  if (futureCIDesc) {
    const p1 = metrics.controlConversionRate;
    const p2 = metrics.treatmentConversionRate;
    const diff = p2 - p1;
    const seDiff = Math.sqrt((p1 * (1 - p1) / metrics.controlUsers) + (p2 * (1 - p2) / metrics.treatmentUsers));
    const ciLow = diff - 1.96 * seDiff;
    const ciHigh = diff + 1.96 * seDiff;
    const ciLowStr = (ciLow >= 0 ? '+' : '') + (ciLow * 100).toFixed(2) + '%';
    const ciHighStr = (ciHigh >= 0 ? '+' : '') + (ciHigh * 100).toFixed(2) + '%';
    futureCIDesc.innerText = `Construct 95% Confidence Interval for the true conversion rate difference [${ciLowStr}, ${ciHighStr}] to quantify bounds.`;
  }

  // 10. Presentation Mode Overlay (DYNAMIC)
  document.getElementById('pres-sample-users').innerText = `${formatNumber(metrics.finalCleanedRecords)} Cleaned Users`;
  document.getElementById('pres-control-cr').innerText = formatPercent(metrics.controlConversionRate);
  document.getElementById('pres-control-counts').innerText = `${formatNumber(metrics.controlConversions)} / ${formatNumber(metrics.controlUsers)}`;
  document.getElementById('pres-treatment-cr').innerText = formatPercent(metrics.treatmentConversionRate);
  document.getElementById('pres-treatment-counts').innerText = `${formatNumber(metrics.treatmentConversions)} / ${formatNumber(metrics.treatmentUsers)}`;
  document.getElementById('pres-obs-lift').innerText = liftStr;
  document.getElementById('pres-cr-diff').innerText = `Diff: ${diffPointsStr}`;
  document.getElementById('pres-z-stat').innerText = zStr;
  document.getElementById('pres-p-val').innerText = pValFormatted;

  const presDecision = document.getElementById('pres-decision-badge');
  const presPComp = document.getElementById('pres-p-comp');
  const presStatDesc = document.getElementById('pres-stat-desc');
  const presRecAction = document.getElementById('pres-rec-action');
  const presRecBullets = document.getElementById('pres-rec-bullets');

  if (presDecision && presPComp && presStatDesc && presRecAction && presRecBullets) {
    if (isSig) {
      presDecision.innerHTML = `<i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-400"></i> <span class="text-emerald-400">${metrics.decision}</span>`;
      presPComp.innerText = `p (${pValFormatted}) < α (0.05)`;
      presStatDesc.innerHTML = `The observed conversion difference is <strong>statistically significant</strong> at α = 0.05. The experiment provides strong evidence of a real difference between variants.`;
      
      if (isTreatmentBetter) {
        presRecAction.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5 text-emerald-400"></i> <span>CONSIDER ADOPTING THE TREATMENT LANDING PAGE</span>`;
        presRecBullets.innerHTML = `
          <li class="flex items-start gap-1.5">
            <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0"></i>
            <span>Treatment demonstrated a verified conversion lift of ${liftStr} (${formatPercent(metrics.treatmentConversionRate)} vs ${formatPercent(metrics.controlConversionRate)}).</span>
          </li>
          <li class="flex items-start gap-1.5">
            <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0"></i>
            <span>Prepare phased rollout to 100% traffic while tracking secondary metrics and revenue per visitor.</span>
          </li>
        `;
      } else {
        presRecAction.innerHTML = `<i data-lucide="x-circle" class="w-5 h-5 text-rose-400"></i> <span>RETAIN THE CONTROL LANDING PAGE</span>`;
        presRecBullets.innerHTML = `
          <li class="flex items-start gap-1.5">
            <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0"></i>
            <span>Treatment produced a statistically significant reduction in conversion rate.</span>
          </li>
          <li class="flex items-start gap-1.5">
            <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0"></i>
            <span>Retain the baseline page and analyze friction points in the redesigned layout.</span>
          </li>
        `;
      }
    } else {
      presDecision.innerHTML = `<i data-lucide="alert-circle" class="w-3.5 h-3.5 text-amber-400"></i> <span class="text-amber-400">${metrics.decision}</span>`;
      presPComp.innerText = `p (${pValFormatted}) > α (0.05)`;
      presStatDesc.innerHTML = `The observed conversion difference is <strong>not statistically significant</strong>. The experiment does not provide sufficient evidence that the new page altered conversion.`;
      presRecAction.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5 text-indigo-400"></i> <span>RETAIN THE EXISTING LANDING PAGE FOR NOW</span>`;
      presRecBullets.innerHTML = `
        <li class="flex items-start gap-1.5">
          <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0"></i>
          <span>Avoid costly migration risk for a variant lacking evidence of lift.</span>
        </li>
        <li class="flex items-start gap-1.5">
          <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0"></i>
          <span>Refine value proposition, CTAs, and run multivariate iterations.</span>
        </li>
      `;
    }
  }

  // Render Charts & Gaussian Curve
  renderConversionCharts(metrics);
  drawGaussianDistributionCurve(metrics);
  lucide.createIcons();
}

// --- 5. CHART.JS VISUALIZATIONS ---

function renderConversionCharts(metrics) {
  const controlCR = (metrics.controlConversionRate * 100);
  const treatmentCR = (metrics.treatmentConversionRate * 100);
  const maxCR = Math.max(controlCR, treatmentCR);
  const yAxisMax = Math.max(15, Math.ceil(maxCR * 1.25));

  // --- Chart 1: Conversion Rates Comparison Bar Chart ---
  const ctx1 = document.getElementById('conversionRateChart').getContext('2d');
  if (conversionRateChartInstance) {
    conversionRateChartInstance.destroy();
  }

  conversionRateChartInstance = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: ['Control (old_page)', 'Treatment (new_page)'],
      datasets: [{
        label: 'Conversion Rate (%)',
        data: [controlCR.toFixed(2), treatmentCR.toFixed(2)],
        backgroundColor: [
          'rgba(59, 130, 246, 0.85)', // Blue-500
          'rgba(99, 102, 241, 0.85)'  // Indigo-500
        ],
        borderColor: [
          '#2563eb',
          '#4f46e5'
        ],
        borderWidth: 1.5,
        borderRadius: 8,
        barThickness: 52
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { family: 'Inter', size: 12, weight: 'bold' },
          bodyFont: { family: 'Inter', size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const val = context.raw;
              const conversions = context.dataIndex === 0 ? metrics.controlConversions : metrics.treatmentConversions;
              const total = context.dataIndex === 0 ? metrics.controlUsers : metrics.treatmentUsers;
              return [
                `Conversion Rate: ${val}%`,
                `Converted: ${formatNumber(conversions)} / ${formatNumber(total)}`
              ];
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: yAxisMax,
          ticks: {
            callback: function(value) {
              return value + '%';
            },
            font: { family: 'Inter', size: 11 },
            color: '#64748b'
          },
          grid: {
            color: '#f1f5f9'
          }
        },
        x: {
          ticks: {
            font: { family: 'Inter', size: 11, weight: 'bold' },
            color: '#334155'
          },
          grid: {
            display: false
          }
        }
      }
    }
  });

  // --- Chart 2: Converted vs Non-Converted Stacked Bar Chart ---
  const ctx2 = document.getElementById('stackedConversionChart').getContext('2d');
  if (stackedConversionChartInstance) {
    stackedConversionChartInstance.destroy();
  }

  const controlConverted = metrics.controlConversions;
  const controlNotConverted = metrics.controlUsers - metrics.controlConversions;
  const treatmentConverted = metrics.treatmentConversions;
  const treatmentNotConverted = metrics.treatmentUsers - metrics.treatmentConversions;

  stackedConversionChartInstance = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: ['Control (old_page)', 'Treatment (new_page)'],
      datasets: [
        {
          label: 'Converted',
          data: [controlConverted, treatmentConverted],
          backgroundColor: 'rgba(16, 185, 129, 0.85)', // Emerald-500
          borderColor: '#059669',
          borderWidth: 1,
          borderRadius: 6
        },
        {
          label: 'Not Converted',
          data: [controlNotConverted, treatmentNotConverted],
          backgroundColor: 'rgba(148, 163, 184, 0.45)', // Slate-400
          borderColor: '#94a3b8',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { family: 'Inter', size: 11, weight: '600' },
            color: '#475569',
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleFont: { family: 'Inter', size: 12, weight: 'bold' },
          bodyFont: { family: 'Inter', size: 12 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: function(context) {
              const label = context.dataset.label;
              const val = context.raw;
              const total = context.dataIndex === 0 ? metrics.controlUsers : metrics.treatmentUsers;
              const pct = total > 0 ? ((val / total) * 100).toFixed(2) : '0.00';
              return `${label}: ${formatNumber(val)} (${pct}%)`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: {
            font: { family: 'Inter', size: 11, weight: 'bold' },
            color: '#334155'
          },
          grid: { display: false }
        },
        y: {
          stacked: true,
          ticks: {
            callback: function(value) {
              return (value / 1000).toFixed(0) + 'k';
            },
            font: { family: 'Inter', size: 11 },
            color: '#64748b'
          },
          grid: {
            color: '#f1f5f9'
          }
        }
      }
    }
  });
}

// --- 6. FULLY DYNAMIC GAUSSIAN NORMAL DISTRIBUTION CANVAS ---

function drawGaussianDistributionCurve(metrics) {
  const canvas = document.getElementById('gaussianDistributionCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  const paddingLeft = 45;
  const paddingRight = 45;
  const paddingTop = 32;
  const paddingBottom = 42;

  const plotW = w - paddingLeft - paddingRight;
  const plotH = h - paddingTop - paddingBottom;

  // We keep the standard normal bell curve focused around -4.0 to +4.0
  const minZ = -4.0;
  const maxZ = 4.0;
  const maxPDF = 0.42;

  function toScreenX(z) {
    return paddingLeft + ((z - minZ) / (maxZ - minZ)) * plotW;
  }

  function toScreenY(pdf) {
    return paddingTop + plotH - (pdf / maxPDF) * plotH;
  }

  const steps = 320;
  const zCritLeft = -1.96;
  const zCritRight = 1.96;
  const observedZ = metrics.zStatistic;
  const isExtreme = Math.abs(observedZ) > 3.6;

  // 1. Shading Critical Rejection Tails (alpha/2 = 0.025 on left & right)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.28)'; // Red-500 tint
  
  // Left Rejection Tail (z < -1.96)
  ctx.beginPath();
  ctx.moveTo(toScreenX(minZ), toScreenY(0));
  for (let i = 0; i <= steps; i++) {
    const z = minZ + (i / steps) * (zCritLeft - minZ);
    ctx.lineTo(toScreenX(z), toScreenY(standardNormalPDF(z)));
  }
  ctx.lineTo(toScreenX(zCritLeft), toScreenY(0));
  ctx.closePath();
  ctx.fill();

  // Right Rejection Tail (z > +1.96)
  ctx.beginPath();
  ctx.moveTo(toScreenX(zCritRight), toScreenY(0));
  for (let i = 0; i <= steps; i++) {
    const z = zCritRight + (i / steps) * (maxZ - zCritRight);
    ctx.lineTo(toScreenX(z), toScreenY(standardNormalPDF(z)));
  }
  ctx.lineTo(toScreenX(maxZ), toScreenY(0));
  ctx.closePath();
  ctx.fill();

  // 2. Shading p-value tails (|z| >= |observedZ|)
  if (!isExtreme) {
    ctx.fillStyle = 'rgba(99, 102, 241, 0.38)'; // Indigo-500 tint
    const absObsZ = Math.abs(observedZ);
    
    // Left p-tail (z <= -absObsZ)
    ctx.beginPath();
    ctx.moveTo(toScreenX(minZ), toScreenY(0));
    for (let i = 0; i <= steps; i++) {
      const z = minZ + (i / steps) * (-absObsZ - minZ);
      ctx.lineTo(toScreenX(z), toScreenY(standardNormalPDF(z)));
    }
    ctx.lineTo(toScreenX(-absObsZ), toScreenY(0));
    ctx.closePath();
    ctx.fill();

    // Right p-tail (z >= absObsZ)
    ctx.beginPath();
    ctx.moveTo(toScreenX(absObsZ), toScreenY(0));
    for (let i = 0; i <= steps; i++) {
      const z = absObsZ + (i / steps) * (maxZ - absObsZ);
      ctx.lineTo(toScreenX(z), toScreenY(standardNormalPDF(z)));
    }
    ctx.lineTo(toScreenX(maxZ), toScreenY(0));
    ctx.closePath();
    ctx.fill();
  }

  // 3. Draw Normal Distribution Bell Curve Line
  ctx.beginPath();
  ctx.strokeStyle = '#818cf8'; // Indigo-400
  ctx.lineWidth = 2.5;
  for (let i = 0; i <= steps; i++) {
    const z = minZ + (i / steps) * (maxZ - minZ);
    const x = toScreenX(z);
    const y = toScreenY(standardNormalPDF(z));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 4. Baseline Axis
  ctx.beginPath();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.moveTo(paddingLeft, toScreenY(0));
  ctx.lineTo(w - paddingRight, toScreenY(0));
  ctx.stroke();

  // 5. Critical Threshold Dashed Lines (+-1.96)
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#f87171'; // Red-400
  ctx.lineWidth = 1.5;

  // Left Critical Line (-1.96)
  ctx.beginPath();
  ctx.moveTo(toScreenX(zCritLeft), toScreenY(0));
  ctx.lineTo(toScreenX(zCritLeft), toScreenY(standardNormalPDF(zCritLeft)));
  ctx.stroke();

  // Right Critical Line (+1.96)
  ctx.beginPath();
  ctx.moveTo(toScreenX(zCritRight), toScreenY(0));
  ctx.lineTo(toScreenX(zCritRight), toScreenY(standardNormalPDF(zCritRight)));
  ctx.stroke();
  ctx.restore();

  // 6. Draw Observed Test Statistic Marker
  ctx.save();
  if (isExtreme) {
    // Extreme Z value (e.g. z = +9.863 or z = -8.5)
    const isPositiveExtreme = observedZ > 0;
    const markerScreenX = isPositiveExtreme ? toScreenX(3.85) : toScreenX(-3.85);

    // Indicator Line
    ctx.strokeStyle = '#10b981'; // Emerald-500 for significant positive
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(markerScreenX, toScreenY(0));
    ctx.lineTo(markerScreenX, paddingTop + 10);
    ctx.stroke();

    // Pulse Dot
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(markerScreenX, paddingTop + 10, 6, 0, 2 * Math.PI);
    ctx.fill();

    // Text Tag
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = isPositiveExtreme ? 'right' : 'left';
    ctx.fillText(`Observed z ≈ ${observedZ >= 0 ? '+' : ''}${observedZ.toFixed(3)} (Rejection Region &rarr;)`, isPositiveExtreme ? markerScreenX - 8 : markerScreenX + 8, paddingTop + 14);

  } else {
    // Standard Z value within visible range
    const markerColor = Math.abs(observedZ) >= 1.96 ? '#10b981' : '#fbbf24';
    ctx.strokeStyle = markerColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(toScreenX(observedZ), toScreenY(0));
    ctx.lineTo(toScreenX(observedZ), toScreenY(standardNormalPDF(observedZ)) - 14);
    ctx.stroke();

    // Dot Marker on Curve
    ctx.fillStyle = markerColor;
    ctx.beginPath();
    ctx.arc(toScreenX(observedZ), toScreenY(standardNormalPDF(observedZ)), 5, 0, 2 * Math.PI);
    ctx.fill();

    // Observed Z Value Tag
    ctx.fillStyle = markerColor;
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    const tagY = Math.max(paddingTop + 12, toScreenY(standardNormalPDF(observedZ)) - 20);
    ctx.fillText(`Observed z = ${observedZ >= 0 ? '+' : ''}${observedZ.toFixed(3)}`, toScreenX(observedZ), tagY);
  }
  ctx.restore();

  // 7. Labels & Ticks
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';

  // Z ticks
  [-3, -2, -1, 0, 1, 2, 3].forEach(z => {
    ctx.fillText(`${z}`, toScreenX(z), toScreenY(0) + 15);
  });

  // Critical Value Text
  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 10px JetBrains Mono, monospace';
  ctx.fillText('z = -1.96', toScreenX(zCritLeft), toScreenY(0) + 28);
  ctx.fillText('z = +1.96', toScreenX(zCritRight), toScreenY(0) + 28);

  // Center Region Status Text
  ctx.font = '10px Inter, sans-serif';
  if (Math.abs(observedZ) >= 1.96) {
    ctx.fillStyle = '#10b981';
    ctx.fillText('REJECT H₀ REGION (Statistically Significant at α = 0.05)', toScreenX(0), toScreenY(0.20));
  } else {
    ctx.fillStyle = '#64748b';
    ctx.fillText('Fail to Reject Region (95% Confidence, α = 0.05)', toScreenX(0), toScreenY(0.20));
  }
}

// --- 7. CSV PARSER, DATA VALIDATOR & CLEANING PIPELINE ---

function setupDataInteraction() {
  const fileInput = document.getElementById('csv-file-input');
  const dropZone = document.getElementById('drop-zone');
  const runBtn = document.getElementById('run-analysis-btn');
  const resetBtn = document.getElementById('reset-default-btn');
  const feedbackContent = document.getElementById('pipeline-feedback-content');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadedFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadedFile(e.target.files[0]);
    }
  });

  resetBtn.addEventListener('click', () => {
    currentMetrics = { ...DEFAULT_METRICS };
    updateDashboardUI(currentMetrics);
    
    document.getElementById('active-dataset-label').innerHTML = `
      <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i>
      IBM Project Verified Data
    `;
    document.getElementById('active-dataset-desc').innerText = '290,584 cleaned user records ready for statistical evaluation.';
    const feedbackBanner = document.getElementById('pipeline-feedback-banner');
    feedbackBanner.className = "bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 flex items-start gap-3 text-xs text-indigo-950";
    if (feedbackContent) {
      feedbackContent.innerHTML = `
        <strong class="font-semibold text-indigo-900">Project Baseline Loaded:</strong>
        <span class="text-indigo-800"> Initial 294,478 rows parsed &bull; 3,894 initial duplicate users &bull; 3,893 invalid combinations filtered &bull; 1 duplicate user removed &bull; Cleaned dataset: 290,584 records.</span>
      `;
    }
    lucide.createIcons();
  });

  runBtn.addEventListener('click', () => {
    runBtn.classList.add('opacity-75');
    runBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Analyzing Pipeline...</span>`;
    lucide.createIcons();

    setTimeout(() => {
      updateDashboardUI(currentMetrics);
      runBtn.classList.remove('opacity-75');
      runBtn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i><span>Run Analysis & Update Metrics</span>`;
      lucide.createIcons();
    }, 300);
  });
}

function handleUploadedFile(file) {
  const progressContainer = document.getElementById('parsing-progress-container');
  const progressBar = document.getElementById('parsing-progress-bar');
  const statusText = document.getElementById('parsing-status-text');
  const percentText = document.getElementById('parsing-percent-text');

  progressContainer.classList.remove('hidden');
  progressBar.style.width = '25%';
  statusText.innerText = `Parsing ${file.name}...`;
  percentText.innerText = '25%';

  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: function(results) {
      progressBar.style.width = '70%';
      statusText.innerText = 'Executing Data Cleaning & Statistical Tests...';
      percentText.innerText = '70%';

      setTimeout(() => {
        processUploadedRows(results.data, file.name);
        progressBar.style.width = '100%';
        percentText.innerText = '100%';
        statusText.innerText = 'Analysis Complete!';

        setTimeout(() => {
          progressContainer.classList.add('hidden');
        }, 1000);
      }, 250);
    },
    error: function(err) {
      progressContainer.classList.add('hidden');
      alert('Error parsing CSV file: ' + err.message);
    }
  });
}

function processUploadedRows(rows, fileName) {
  const rawCount = rows.length;
  if (rawCount === 0) {
    alert('Uploaded CSV file is empty.');
    return;
  }

  // Verify headers
  const sample = rows[0];
  const requiredCols = ['user_id', 'group', 'landing_page', 'converted'];
  const hasCols = requiredCols.every(col => col in sample);

  if (!hasCols) {
    alert('Invalid CSV format. Missing required columns: user_id, group, landing_page, converted');
    return;
  }

  // 1. Check duplicate user_ids in raw data
  const rawUserCounts = new Map();
  let initialDuplicates = 0;
  let missingValues = 0;

  for (let i = 0; i < rawCount; i++) {
    const row = rows[i];
    const uid = row.user_id;
    if (uid === null || uid === undefined || row.group === null || row.landing_page === null || row.converted === null) {
      missingValues++;
    }
    rawUserCounts.set(uid, (rawUserCounts.get(uid) || 0) + 1);
  }

  rawUserCounts.forEach(count => {
    if (count > 1) {
      initialDuplicates += (count - 1);
    }
  });

  // 2. Identify & Remove Invalid Assignments:
  // Valid: control + old_page, treatment + new_page
  let controlNewMismatch = 0;
  let treatmentOldMismatch = 0;
  const validAssignmentRows = [];

  for (let i = 0; i < rawCount; i++) {
    const r = rows[i];
    const grp = String(r.group).trim().toLowerCase();
    const page = String(r.landing_page).trim().toLowerCase();

    if (grp === 'control' && page === 'new_page') {
      controlNewMismatch++;
    } else if (grp === 'treatment' && page === 'old_page') {
      treatmentOldMismatch++;
    } else if ((grp === 'control' && page === 'old_page') || (grp === 'treatment' && page === 'new_page')) {
      validAssignmentRows.push(r);
    }
  }

  const invalidAssignmentsRemoved = controlNewMismatch + treatmentOldMismatch;

  // 3. Handle residual duplicate users in valid assignments (keep first occurrence)
  const seenUsers = new Set();
  const cleanedDataset = [];
  let dedupedUsersCount = 0;

  for (let i = 0; i < validAssignmentRows.length; i++) {
    const r = validAssignmentRows[i];
    const uid = r.user_id;
    if (seenUsers.has(uid)) {
      dedupedUsersCount++;
    } else {
      seenUsers.add(uid);
      cleanedDataset.push(r);
    }
  }

  const finalCleanedRecords = cleanedDataset.length;

  // 4. Calculate Control vs Treatment aggregates
  let controlUsers = 0;
  let controlConversions = 0;
  let treatmentUsers = 0;
  let treatmentConversions = 0;

  for (let i = 0; i < finalCleanedRecords; i++) {
    const r = cleanedDataset[i];
    const grp = String(r.group).trim().toLowerCase();
    const conv = Number(r.converted) === 1 ? 1 : 0;

    if (grp === 'control') {
      controlUsers++;
      if (conv === 1) controlConversions++;
    } else if (grp === 'treatment') {
      treatmentUsers++;
      if (conv === 1) treatmentConversions++;
    }
  }

  // 5. Run Two-Proportion Z-Test
  const testResults = computeTwoProportionZTest(controlUsers, controlConversions, treatmentUsers, treatmentConversions);

  // Update State
  currentMetrics = {
    rawRecords: rawCount,
    initialDuplicates: initialDuplicates,
    controlNewMismatch: controlNewMismatch,
    treatmentOldMismatch: treatmentOldMismatch,
    invalidAssignmentsRemoved: invalidAssignmentsRemoved,
    afterMismatchRemoved: validAssignmentRows.length,
    dedupedUsersCount: dedupedUsersCount,
    finalCleanedRecords: finalCleanedRecords,
    remainingDuplicates: 0,
    missingValues: missingValues,
    ...testResults
  };

  updateDashboardUI(currentMetrics);

  // Update Dataset Feedback UI
  document.getElementById('active-dataset-label').innerHTML = `
    <i data-lucide="file-check" class="w-4 h-4 text-indigo-600"></i>
    Custom Dataset: ${fileName}
  `;
  document.getElementById('active-dataset-desc').innerText = `Processed ${formatNumber(rawCount)} raw rows &rarr; ${formatNumber(finalCleanedRecords)} cleaned records.`;

  const feedbackBanner = document.getElementById('pipeline-feedback-banner');
  const feedbackContent = document.getElementById('pipeline-feedback-content');
  feedbackBanner.className = "bg-emerald-50/90 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-emerald-950";
  if (feedbackContent) {
    feedbackContent.innerHTML = `
      <strong class="font-semibold text-emerald-900">Custom Dataset Successfully Processed:</strong>
      <span class="text-emerald-800"> Cleaned ${formatNumber(finalCleanedRecords)} valid users &bull; Control: ${formatPercent(testResults.controlConversionRate)} (${formatNumber(testResults.controlConversions)}/${formatNumber(testResults.controlUsers)}) &bull; Treatment: ${formatPercent(testResults.treatmentConversionRate)} (${formatNumber(testResults.treatmentConversions)}/${formatNumber(testResults.treatmentUsers)}) &bull; z = ${testResults.zStatistic.toFixed(3)}, p-value = ${formatPValue(testResults.pValue)} &bull; Decision: <strong>${testResults.decision}</strong>.</span>
    `;
  }
  lucide.createIcons();
}

// --- 8. PRESENTATION MODE OVERLAY CONTROLLER ---

function setupPresentationMode() {
  const toggleBtn = document.getElementById('toggle-presentation-btn');
  const closeBtn = document.getElementById('close-presentation-btn');
  const overlay = document.getElementById('presentation-view');

  function openPresentation() {
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    lucide.createIcons();
  }

  function closePresentation() {
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  toggleBtn.addEventListener('click', openPresentation);
  closeBtn.addEventListener('click', closePresentation);

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
      closePresentation();
    }
  });
}

// --- 9. SIDEBAR SCROLLSPY & SMOOTH NAVIGATION ---

function setupScrollspy() {
  const sections = document.querySelectorAll('main > section');
  const navItems = document.querySelectorAll('.nav-item');

  window.addEventListener('scroll', () => {
    let currentId = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      if (window.scrollY >= sectionTop) {
        currentId = section.getAttribute('id');
      }
    });

    navItems.forEach(item => {
      item.classList.remove('active-nav');
      if (item.getAttribute('href') === `#${currentId}`) {
        item.classList.add('active-nav');
      }
    });
  });
}

// --- 10. RESIZE OBSERVER FOR CANVAS & CHARTS ---

function setupResponsiveCanvas() {
  window.addEventListener('resize', () => {
    drawGaussianDistributionCurve(currentMetrics);
  });
}

// --- 11. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
  updateDashboardUI(DEFAULT_METRICS);
  setupDataInteraction();
  setupPresentationMode();
  setupScrollspy();
  setupResponsiveCanvas();
  lucide.createIcons();
});
