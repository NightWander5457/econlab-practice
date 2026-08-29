import fs from 'node:fs';

const conceptsSource = fs.readFileSync(new URL('../app/concepts.ts', import.meta.url), 'utf8');
const questionsSource = fs.readFileSync(new URL('../app/questions.ts', import.meta.url), 'utf8');
const pageSource = fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');

const conceptRows = [...conceptsSource.matchAll(/^  c\('([^']+)', '(U[12])', '([^']+)',/gm)]
  .map((match) => ({ id: match[1], unit: match[2], topic: match[3] }));
const conceptIds = conceptRows.map((row) => row.id);
const duplicateConceptIds = conceptIds.filter((id, index) => conceptIds.indexOf(id) !== index);

const requiredConceptIds = [
  'u1-opportunity-cost', 'u1-ppf', 'u1-division-labour-benefits', 'u1-financial-markets',
  'u1-free-market-benefits', 'u1-command-costs', 'u1-demand', 'u1-contraction-supply',
  'u1-ped-formula', 'u1-yed-formula', 'u1-xed-formula', 'u1-pes-formula',
  'u1-perfect-inelastic-supply', 'u1-consumer-surplus', 'u1-price-floor-risks',
  'u1-tax-effects', 'u1-subsidy-effects', 'u1-private-good', 'u1-symmetric-information',
  'u1-government-intervention-purpose', 'u1-government-failure', 'u1-politician-self-interest',
  'u2-gdp-per-capita-formula', 'u2-ppp', 'u2-cpi-process', 'u2-deflation-causes',
  'u2-inflation-stakeholders', 'u2-real-wage-unemployment', 'u2-unemployment-effects',
  'u2-capital-account', 'u2-financial-account', 'u2-current-deficit', 'u2-current-transfers',
  'u2-ad-formula', 'u2-consumption-factors', 'u2-saving-ratio-effects', 'u2-gross-investment',
  'u2-government-spending-factors', 'u2-net-trade-factors', 'u2-sras', 'u2-keynesian-lras',
  'u2-mpt', 'u2-mpm', 'u2-multiplier-mpc-formula', 'u2-multiplier-mpw-formula',
  'u2-export-led-growth', 'u2-potential-growth-causes', 'u2-trend-growth',
  'u2-output-gap-measurement', 'u2-balanced-budget', 'u2-income-equality-objective',
  'u2-growth-environment-conflict', 'u2-deregulation', 'u2-privatisation',
  'u2-infrastructure-policy', 'u2-rd-policy', 'u2-fiscal-policy', 'u2-monetary-policy',
  'u2-quantitative-easing', 'u2-central-bank',
];

const missingRequired = requiredConceptIds.filter((id) => !conceptIds.includes(id));
const authoredQuestionCount = (questionsSource.match(/^    id: 'u[12]-/gm) ?? []).length;
const graphBlock = pageSource.match(/const graphTasks = \[([\s\S]*?)\] as const;/)?.[1] ?? '';
const diagramBlock = pageSource.match(/const diagramTasks: DiagramTask\[\] = \[([\s\S]*?)\];\n\nfunction DiagramDrill/)?.[1] ?? '';
const drawTaskIds = [...graphBlock.matchAll(/^  \{ id: '([^']+)'/gm)].map((match) => match[1]);
const diagramTaskIds = [...diagramBlock.matchAll(/^  \{ id: '([^']+)'/gm)].map((match) => match[1]);
const duplicateGraphIds = [...drawTaskIds, ...diagramTaskIds].filter((id, index, all) => all.indexOf(id) !== index);

const expected = {
  concepts: 251,
  u1: 128,
  u2: 123,
  authoredQuestions: 46,
  generatedQuestions: 251 * 3,
  drawTasks: 10,
  diagramTasks: 26,
};

const actual = {
  concepts: conceptRows.length,
  u1: conceptRows.filter((row) => row.unit === 'U1').length,
  u2: conceptRows.filter((row) => row.unit === 'U2').length,
  authoredQuestions: authoredQuestionCount,
  generatedQuestions: conceptRows.length * 3,
  drawTasks: drawTaskIds.length,
  diagramTasks: diagramTaskIds.length,
};

const countErrors = Object.entries(expected)
  .filter(([key, value]) => actual[key] !== value)
  .map(([key, value]) => `${key}: expected ${value}, found ${actual[key]}`);

const errors = [
  ...countErrors,
  ...(duplicateConceptIds.length ? [`duplicate concept IDs: ${[...new Set(duplicateConceptIds)].join(', ')}`] : []),
  ...(duplicateGraphIds.length ? [`duplicate graph IDs: ${[...new Set(duplicateGraphIds)].join(', ')}`] : []),
  ...(missingRequired.length ? [`missing required concepts: ${missingRequired.join(', ')}`] : []),
];

if (errors.length) {
  console.error('Content coverage audit failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Content coverage audit passed: ${actual.concepts} concepts, ${actual.generatedQuestions + actual.authoredQuestions} text questions, ${actual.drawTasks + actual.diagramTasks} graph tasks.`);
