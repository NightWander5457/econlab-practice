import { ConceptStage, concepts } from './concepts';

export type UnitId = 'U1' | 'U2';
export type QuestionKind = 'choice' | 'fill';

export type Question = {
  id: string;
  unit: UnitId;
  topic: string;
  topicZh: string;
  kind: QuestionKind;
  prompt: string;
  promptZh: string;
  options?: string[];
  answerIndex?: number;
  accepted?: string[];
  answerDisplay: string;
  hint: string;
  keywords: Array<[string, string]>;
  explanationZh: string;
  conceptId?: string;
  stage?: ConceptStage;
};

export const unitTopics = {
  U1: [
    ['intro', '基础概念'],
    ['demand-supply', '需求与供给'],
    ['elasticity', '弹性'],
    ['equilibrium', '市场均衡'],
    ['intervention', '税、补贴与政府干预'],
    ['market-failure', '市场失灵'],
  ],
  U2: [
    ['growth', '经济增长'],
    ['inflation', '通货膨胀'],
    ['unemployment', '失业'],
    ['bop', '国际收支'],
    ['ad-as', '总需求与总供给'],
    ['national-income', '国民收入与乘数'],
    ['policy', '宏观政策'],
  ],
} as const;

const foundationQuestions: Question[] = [
  {
    id: 'u1-positive', unit: 'U1', topic: 'intro', topicZh: '基础概念', kind: 'choice',
    prompt: 'Which statement is a positive statement?', promptZh: '哪一项属于实证性表述？',
    options: ['The government should raise the minimum wage.', 'A rise in price usually reduces quantity demanded, ceteris paribus.', 'Income inequality is unfair.'],
    answerIndex: 1, answerDisplay: 'A rise in price usually reduces quantity demanded, ceteris paribus.',
    hint: 'Positive statements can be tested as true or false.', keywords: [['positive', '实证性的'], ['tested', '可以检验']],
    explanationZh: '实证性表述描述“事实是什么”，可以用数据检验。含有 should、fair、unfair 等价值判断的句子通常是规范性表述。',
  },
  {
    id: 'u1-normative-fill', unit: 'U1', topic: 'intro', topicZh: '基础概念', kind: 'fill',
    prompt: 'A statement based on value judgement is called a ______ statement.', promptZh: '基于价值判断的表述叫作什么？',
    accepted: ['normative'], answerDisplay: 'normative', hint: 'It often contains words such as should or fair.',
    keywords: [['value judgement', '价值判断'], ['normative', '规范性的']], explanationZh: 'Normative statement 是规范性表述，带有主观价值判断，无法单纯用数据证明为真或为假。',
  },
  {
    id: 'u1-scarcity', unit: 'U1', topic: 'intro', topicZh: '基础概念', kind: 'choice',
    prompt: 'Why does the basic economic problem exist?', promptZh: '基本经济问题为什么存在？',
    options: ['Resources are unlimited but wants are limited.', 'Resources are scarce but wants are unlimited.', 'All goods have zero opportunity cost.'],
    answerIndex: 1, answerDisplay: 'Resources are scarce but wants are unlimited.', hint: 'Think about finite resources and human wants.',
    keywords: [['scarce', '稀缺的'], ['unlimited wants', '无限欲望']], explanationZh: '资源有限，而人的欲望无限，因此不可能满足所有欲望，必须作出选择。',
  },
  {
    id: 'u1-opp-cost-fill', unit: 'U1', topic: 'intro', topicZh: '基础概念', kind: 'fill',
    prompt: 'Opportunity cost is the next best alternative ______.', promptZh: '机会成本是被放弃的下一个最佳选择。填写关键词。',
    accepted: ['forgone', 'foregone'], answerDisplay: 'forgone', hint: 'The word begins with “for...”.',
    keywords: [['next best alternative', '下一个最佳选择'], ['forgone', '被放弃的']], explanationZh: '完整表达是 the next best alternative forgone。英式教材中 forgone 和 foregone 都可能出现。',
  },
  {
    id: 'u1-ppf-point', unit: 'U1', topic: 'intro', topicZh: '基础概念', kind: 'choice',
    prompt: 'A point inside a production possibility frontier is...', promptZh: 'PPF 曲线以内的点表示什么？',
    options: ['unattainable', 'attainable but productively inefficient', 'productively efficient'],
    answerIndex: 1, answerDisplay: 'attainable but productively inefficient', hint: 'The resources exist, but some are not fully used.',
    keywords: [['attainable', '可以达到'], ['inefficient', '低效率']], explanationZh: '曲线内的点能够达到，但资源没有充分利用，因此是生产低效率。曲线上的点才是生产有效率。',
  },
  {
    id: 'u1-demand-definition', unit: 'U1', topic: 'demand-supply', topicZh: '需求与供给', kind: 'choice',
    prompt: 'Which statement best describes demand?', promptZh: '哪一项最准确地描述需求？',
    options: ['The quantity consumers are willing and able to buy at a given price.', 'The total number of consumers in a country.', 'The quantity firms are willing to produce at any price.'],
    answerIndex: 0, answerDisplay: 'The quantity consumers are willing and able to buy at a given price.', hint: 'Find both “willing” and “able”.',
    keywords: [['willing', '愿意的'], ['able', '有能力的'], ['quantity', '数量']], explanationZh: '需求必须同时包含愿意购买和有能力购买，并且对应特定价格与时期。',
  },
  {
    id: 'u1-demand-price', unit: 'U1', topic: 'demand-supply', topicZh: '需求与供给', kind: 'choice',
    prompt: 'A fall in the price of the product itself causes...', promptZh: '商品自身价格下降会导致什么？',
    options: ['an extension in demand', 'an increase in demand', 'a decrease in demand'],
    answerIndex: 0, answerDisplay: 'an extension in demand', hint: 'Price changes cause movement along the same curve.',
    keywords: [['extension', '需求量扩张'], ['along the curve', '沿曲线移动']], explanationZh: '商品自身价格变化只会导致沿原需求曲线移动。价格下降时是 extension in demand，不是整条需求曲线右移。',
  },
  {
    id: 'u1-demand-shift', unit: 'U1', topic: 'demand-supply', topicZh: '需求与供给', kind: 'choice',
    prompt: 'Nike cuts its price. What is likely to happen to demand for Adidas, a substitute?', promptZh: 'Nike 降价时，作为替代品的 Adidas 需求可能怎样变化？',
    options: ['Shift right', 'Shift left', 'Move upward along the same curve'], answerIndex: 1, answerDisplay: 'Shift left',
    hint: 'Consumers switch toward the cheaper substitute.', keywords: [['substitute', '替代品'], ['shift left', '向左移动']],
    explanationZh: 'Nike 与 Adidas 是替代品。Nike 变便宜后，一部分消费者转买 Nike，因此 Adidas 的需求下降，需求曲线左移。',
  },
  {
    id: 'u1-supply-definition', unit: 'U1', topic: 'demand-supply', topicZh: '需求与供给', kind: 'fill',
    prompt: 'Supply is the quantity producers are willing and ______ to sell.', promptZh: '供给是生产者愿意并且有能力出售的数量。填写缺少的词。',
    accepted: ['able'], answerDisplay: 'able', hint: 'Demand uses the same pair: willing and ...',
    keywords: [['producers', '生产者'], ['able', '有能力的']], explanationZh: '供给定义同样需要 willing and able。只有愿意但没有生产能力，不能形成供给。',
  },
  {
    id: 'u1-supply-cost', unit: 'U1', topic: 'demand-supply', topicZh: '需求与供给', kind: 'choice',
    prompt: 'A rise in firms’ production costs is most likely to...', promptZh: '企业生产成本上升最可能导致什么？',
    options: ['increase supply', 'decrease supply', 'cause an extension in supply'], answerIndex: 1, answerDisplay: 'decrease supply',
    hint: 'At every price, production is now less profitable.', keywords: [['production costs', '生产成本'], ['decrease supply', '供给减少']],
    explanationZh: '成本上升会降低每一个价格水平下的盈利能力，因此供给曲线左移。',
  },
  {
    id: 'u1-equilibrium-fill', unit: 'U1', topic: 'equilibrium', topicZh: '市场均衡', kind: 'fill',
    prompt: 'At market equilibrium, quantity demanded is ______ to quantity supplied.', promptZh: '市场均衡时，需求量与供给量是什么关系？',
    accepted: ['equal', 'equal to'], answerDisplay: 'equal', hint: 'There is neither shortage nor surplus.',
    keywords: [['equilibrium', '均衡'], ['equal', '相等']], explanationZh: '均衡价格处 QD = QS，既没有超额需求，也没有超额供给。',
  },
  {
    id: 'u1-shortage', unit: 'U1', topic: 'equilibrium', topicZh: '市场均衡', kind: 'choice',
    prompt: 'If price is below the equilibrium price, the market has...', promptZh: '价格低于均衡价格时，市场会出现什么？',
    options: ['excess supply', 'excess demand', 'productive efficiency'], answerIndex: 1, answerDisplay: 'excess demand',
    hint: 'A low price encourages buyers but discourages sellers.', keywords: [['excess demand', '超额需求'], ['shortage', '短缺']],
    explanationZh: '低于均衡价格时，需求量大于供给量，形成 excess demand，也叫 shortage。',
  },
  {
    id: 'u1-consumer-surplus', unit: 'U1', topic: 'equilibrium', topicZh: '市场均衡', kind: 'choice',
    prompt: 'Consumer surplus is the difference between...', promptZh: '消费者剩余是哪两个数值之间的差额？',
    options: ['the price consumers are willing to pay and the price actually paid', 'total revenue and total cost', 'exports and imports'],
    answerIndex: 0, answerDisplay: 'willingness to pay minus the price actually paid', hint: 'It measures the buyer’s extra benefit.',
    keywords: [['willing to pay', '愿意支付'], ['actually paid', '实际支付']], explanationZh: '消费者愿意支付的最高价格高于实际市场价格时，中间的差额就是消费者剩余。',
  },
  {
    id: 'u1-ped-formula', unit: 'U1', topic: 'elasticity', topicZh: '弹性', kind: 'choice',
    prompt: 'Which is the correct formula for PED?', promptZh: 'PED 的正确公式是哪一个？',
    options: ['% change in quantity demanded ÷ % change in price', '% change in price ÷ % change in quantity demanded', 'change in total revenue ÷ change in price'],
    answerIndex: 0, answerDisplay: '% change in quantity demanded ÷ % change in price', hint: 'Response goes on top; cause goes below.',
    keywords: [['quantity demanded', '需求量'], ['price', '价格']], explanationZh: 'PED 衡量需求量对价格变化的反应程度，因此用需求量变动百分比除以价格变动百分比。',
  },
  {
    id: 'u1-ped-calc', unit: 'U1', topic: 'elasticity', topicZh: '弹性', kind: 'fill',
    prompt: 'Quantity demanded falls by 20% when price rises by 10%. Enter the absolute PED value.', promptZh: '价格上升 10%，需求量下降 20%。填写 PED 的绝对值。',
    accepted: ['2', '2.0', '2.00'], answerDisplay: '2', hint: '20 ÷ 10 = ?',
    keywords: [['absolute value', '绝对值'], ['elastic', '富有弹性']], explanationZh: 'PED = -20% ÷ 10% = -2。比较弹性大小时常用绝对值 2，因此需求富有弹性。',
  },
  {
    id: 'u1-ped-revenue', unit: 'U1', topic: 'elasticity', topicZh: '弹性', kind: 'choice',
    prompt: 'Demand is price elastic. If price falls, total revenue will usually...', promptZh: '需求富有价格弹性时，价格下降通常会使总收益怎样变化？',
    options: ['rise', 'fall', 'stay unchanged'], answerIndex: 0, answerDisplay: 'rise', hint: 'Quantity changes by a larger percentage than price.',
    keywords: [['total revenue', '总收益'], ['price elastic', '富有价格弹性']], explanationZh: '需求富有弹性时，降价带来的需求量百分比增加更大，因此 P×Q 的总收益上升。',
  },
  {
    id: 'u1-xed-substitute', unit: 'U1', topic: 'elasticity', topicZh: '弹性', kind: 'choice',
    prompt: 'A positive cross elasticity of demand suggests the two goods are...', promptZh: 'XED 为正说明两种商品是什么关系？',
    options: ['substitutes', 'complements', 'public goods'], answerIndex: 0, answerDisplay: 'substitutes', hint: 'When one price rises, demand for the other rises.',
    keywords: [['positive XED', '正的交叉弹性'], ['substitutes', '替代品']], explanationZh: '替代品的 XED 为正。一个商品涨价时，消费者转向另一个商品，使另一个商品需求增加。',
  },
  {
    id: 'u1-tax-supply', unit: 'U1', topic: 'intervention', topicZh: '税、补贴与政府干预', kind: 'choice',
    prompt: 'An indirect tax on producers normally shifts the supply curve...', promptZh: '对生产者征收间接税通常使供给曲线怎样移动？',
    options: ['right', 'left', 'not at all'], answerIndex: 1, answerDisplay: 'left', hint: 'The tax raises the cost of supplying each unit.',
    keywords: [['indirect tax', '间接税'], ['shift left', '左移']], explanationZh: '间接税相当于提高生产成本，因此每个价格下企业愿意供给的数量减少，供给曲线左移。',
  },
  {
    id: 'u1-subsidy', unit: 'U1', topic: 'intervention', topicZh: '税、补贴与政府干预', kind: 'fill',
    prompt: 'A government payment that encourages production is called a ______.', promptZh: '政府为鼓励生产而支付的款项叫什么？',
    accepted: ['subsidy'], answerDisplay: 'subsidy', hint: 'It usually shifts supply to the right.',
    keywords: [['government payment', '政府付款'], ['subsidy', '补贴']], explanationZh: 'Subsidy 是补贴，它降低企业的有效生产成本，通常使供给曲线右移。',
  },
  {
    id: 'u1-max-price', unit: 'U1', topic: 'intervention', topicZh: '税、补贴与政府干预', kind: 'choice',
    prompt: 'For a maximum price to affect the market, it must be set...', promptZh: '最高限价要产生作用，必须设置在哪里？',
    options: ['above equilibrium', 'below equilibrium', 'exactly at any price'], answerIndex: 1, answerDisplay: 'below equilibrium', hint: 'It is intended to keep the price lower.',
    keywords: [['maximum price', '最高限价'], ['below equilibrium', '低于均衡']], explanationZh: '有效最高限价必须低于市场均衡价格，否则市场价格本来就不会达到这个上限。它通常会造成短缺。',
  },
  {
    id: 'u1-market-failure', unit: 'U1', topic: 'market-failure', topicZh: '市场失灵', kind: 'fill',
    prompt: 'Market failure occurs when resources are allocated ______.', promptZh: '市场失灵是资源被怎样配置？填写关键词。',
    accepted: ['inefficiently', 'inefficient'], answerDisplay: 'inefficiently', hint: 'The allocation does not maximise social welfare.',
    keywords: [['allocated', '配置'], ['inefficiently', '低效率地']], explanationZh: '市场失灵是自由市场导致资源低效率配置，社会福利未能最大化。',
  },
  {
    id: 'u1-negative-externality', unit: 'U1', topic: 'market-failure', topicZh: '市场失灵', kind: 'choice',
    prompt: 'Pollution from a factory is an example of...', promptZh: '工厂污染属于哪一种情况？',
    options: ['a positive production externality', 'a negative production externality', 'a free good'], answerIndex: 1, answerDisplay: 'a negative production externality', hint: 'A third party suffers an external cost.',
    keywords: [['third party', '第三方'], ['external cost', '外部成本']], explanationZh: '工厂生产使交易之外的居民承担健康或环境成本，因此是生产的负外部性。',
  },
  {
    id: 'u1-public-good', unit: 'U1', topic: 'market-failure', topicZh: '市场失灵', kind: 'choice',
    prompt: 'A pure public good is...', promptZh: '纯公共品具有什么特点？',
    options: ['rival and excludable', 'non-rival and non-excludable', 'scarce but always profitable'], answerIndex: 1, answerDisplay: 'non-rival and non-excludable',
    hint: 'One person’s use does not reduce another’s, and non-payers cannot easily be excluded.', keywords: [['non-rival', '非竞争性'], ['non-excludable', '非排他性']],
    explanationZh: '公共品同时具有非竞争性和非排他性，这会产生搭便车问题，使私人市场可能不愿提供。',
  },
  {
    id: 'u2-gdp', unit: 'U2', topic: 'growth', topicZh: '经济增长', kind: 'fill',
    prompt: 'GDP stands for Gross Domestic ______.', promptZh: 'GDP 的完整英文是什么？填写最后一个词。',
    accepted: ['product'], answerDisplay: 'Product', hint: 'It measures the value of final output.',
    keywords: [['Gross Domestic Product', '国内生产总值']], explanationZh: 'GDP 是 Gross Domestic Product，衡量一国一定时期内生产的最终商品和服务的市场价值。',
  },
  {
    id: 'u2-real-gdp', unit: 'U2', topic: 'growth', topicZh: '经济增长', kind: 'choice',
    prompt: 'Real GDP differs from nominal GDP because real GDP...', promptZh: '实际 GDP 与名义 GDP 的主要区别是什么？',
    options: ['accounts for inflation', 'includes only exports', 'is always lower'], answerIndex: 0, answerDisplay: 'accounts for inflation', hint: 'Real values remove the effect of price changes.',
    keywords: [['real GDP', '实际 GDP'], ['inflation', '通货膨胀']], explanationZh: '实际 GDP 调整了价格水平变化，因此更能反映真实产量变化。名义 GDP 可能只因物价上涨而增加。',
  },
  {
    id: 'u2-recession', unit: 'U2', topic: 'growth', topicZh: '经济增长', kind: 'choice',
    prompt: 'A common technical definition of recession is...', promptZh: '经济衰退常见的技术定义是什么？',
    options: ['one month of falling prices', 'two consecutive quarters of negative real GDP growth', 'any rise in unemployment'],
    answerIndex: 1, answerDisplay: 'two consecutive quarters of negative real GDP growth', hint: 'Remember the number of quarters.',
    keywords: [['consecutive quarters', '连续季度'], ['negative growth', '负增长']], explanationZh: '常见技术定义是实际 GDP 连续两个季度负增长。',
  },
  {
    id: 'u2-gdp-limit', unit: 'U2', topic: 'growth', topicZh: '经济增长', kind: 'choice',
    prompt: 'Why may GDP per capita fail to show living standards accurately?', promptZh: '为什么人均 GDP 可能无法准确反映生活水平？',
    options: ['It shows income distribution perfectly.', 'It ignores factors such as income distribution and quality of life.', 'It already includes every unpaid activity.'],
    answerIndex: 1, answerDisplay: 'It ignores income distribution and quality of life.', hint: 'An average can hide differences between people.',
    keywords: [['income distribution', '收入分配'], ['quality of life', '生活质量']], explanationZh: '人均 GDP 是平均数，不能说明收入是否公平分配，也没有完整反映环境、闲暇、健康等生活质量因素。',
  },
  {
    id: 'u2-inflation-fill', unit: 'U2', topic: 'inflation', topicZh: '通货膨胀', kind: 'fill',
    prompt: 'Inflation is a sustained increase in the average ______ level.', promptZh: '通货膨胀是平均什么水平的持续上升？',
    accepted: ['price'], answerDisplay: 'price', hint: 'CPI measures changes in this level.',
    keywords: [['sustained', '持续的'], ['price level', '价格水平']], explanationZh: 'Inflation 是总体或平均价格水平持续上升，不是某一种商品的一次性涨价。',
  },
  {
    id: 'u2-deflation', unit: 'U2', topic: 'inflation', topicZh: '通货膨胀', kind: 'choice',
    prompt: 'Which statement correctly defines deflation?', promptZh: '哪一项正确描述通货紧缩？',
    options: ['The price level is falling.', 'The inflation rate falls from 5% to 3%.', 'The price level rises more slowly.'],
    answerIndex: 0, answerDisplay: 'The price level is falling.', hint: 'A lower positive inflation rate is disinflation, not deflation.',
    keywords: [['deflation', '通货紧缩'], ['falling price level', '价格水平下降']], explanationZh: '通货紧缩是总体价格水平下降。通胀率从 5% 降到 3% 时价格仍在上涨，只是涨得更慢，这叫 disinflation。',
  },
  {
    id: 'u2-cpi', unit: 'U2', topic: 'inflation', topicZh: '通货膨胀', kind: 'choice',
    prompt: 'Why are weights used when calculating CPI?', promptZh: '计算 CPI 时为什么要使用权重？',
    options: ['All products have the same importance.', 'Households spend different proportions of income on different items.', 'Weights remove all measurement errors.'],
    answerIndex: 1, answerDisplay: 'Households spend different proportions on different items.', hint: 'Rent matters more to a budget than pencils.',
    keywords: [['weights', '权重'], ['proportion of expenditure', '支出比例']], explanationZh: '不同商品在家庭支出中的占比不同，因此需要按支出比例加权。权重不能消除所有测量误差。',
  },
  {
    id: 'u2-demand-pull', unit: 'U2', topic: 'inflation', topicZh: '通货膨胀', kind: 'choice',
    prompt: 'Demand-pull inflation is most likely when...', promptZh: '什么情况下最可能发生需求拉动型通胀？',
    options: ['aggregate demand grows faster than productive capacity', 'oil prices fall sharply', 'aggregate demand shifts left'],
    answerIndex: 0, answerDisplay: 'aggregate demand grows faster than productive capacity', hint: 'Too much spending chases limited output.',
    keywords: [['demand-pull', '需求拉动型'], ['aggregate demand', '总需求']], explanationZh: '当总需求增长快于经济的生产能力时，过多支出追逐有限产出，价格水平会上升。',
  },
  {
    id: 'u2-unemployment-ilo', unit: 'U2', topic: 'unemployment', topicZh: '失业', kind: 'choice',
    prompt: 'Under the ILO definition, an unemployed person must be...', promptZh: '按 ILO 定义，失业者必须符合什么条件？',
    options: ['not working and not interested in work', 'available for work and actively seeking work', 'working part-time only'],
    answerIndex: 1, answerDisplay: 'available for work and actively seeking work', hint: 'Two ideas are required: ready and looking.',
    keywords: [['available for work', '可以工作'], ['actively seeking', '积极寻找']], explanationZh: '失业者不仅是“没有工作”，还必须能够较快开始工作，并且最近积极寻找过工作。',
  },
  {
    id: 'u2-structural', unit: 'U2', topic: 'unemployment', topicZh: '失业', kind: 'choice',
    prompt: 'Structural unemployment is mainly caused by...', promptZh: '结构性失业主要由什么造成？',
    options: ['a mismatch between workers’ skills and available jobs', 'people moving briefly between jobs', 'seasonal changes in tourism'],
    answerIndex: 0, answerDisplay: 'a mismatch between skills and available jobs', hint: 'The structure of the economy has changed.',
    keywords: [['mismatch', '不匹配'], ['skills', '技能']], explanationZh: '产业结构变化后，劳动者原有技能与新岗位要求不匹配，会产生结构性失业。',
  },
  {
    id: 'u2-inactive', unit: 'U2', topic: 'unemployment', topicZh: '失业', kind: 'fill',
    prompt: 'People not working and not actively looking for work are economically ______.', promptZh: '没有工作且没有积极寻找工作的人属于经济非活跃人口。填写英文词。',
    accepted: ['inactive'], answerDisplay: 'inactive', hint: 'The word is the opposite of active.',
    keywords: [['economically inactive', '经济非活跃']], explanationZh: 'Economically inactive 人口不属于劳动力，因此通常不计入失业人数或失业率分母。',
  },
  {
    id: 'u2-current-account', unit: 'U2', topic: 'bop', topicZh: '国际收支', kind: 'choice',
    prompt: 'Which item belongs to the current account?', promptZh: '哪一项属于经常账户？',
    options: ['trade in goods and services', 'the sale of a domestic factory to a foreign investor only', 'central bank reserve assets only'],
    answerIndex: 0, answerDisplay: 'trade in goods and services', hint: 'Think about exports, imports, income and transfers.',
    keywords: [['current account', '经常账户'], ['goods and services', '商品与服务']], explanationZh: '经常账户记录商品和服务贸易，以及跨境收入与经常转移。',
  },
  {
    id: 'u2-depreciation', unit: 'U2', topic: 'bop', topicZh: '国际收支', kind: 'choice',
    prompt: 'A depreciation of a country’s currency initially makes its exports...', promptZh: '本国货币贬值最初会使本国出口商品对外国买家怎样变化？',
    options: ['more expensive', 'cheaper', 'unchanged in every case'], answerIndex: 1, answerDisplay: 'cheaper', hint: 'Foreign currency can buy more domestic currency.',
    keywords: [['depreciation', '贬值'], ['exports', '出口']], explanationZh: '其他条件不变时，本币贬值会降低外国买家眼中的出口价格，同时提高本国买家的进口价格。',
  },
  {
    id: 'u2-ad-formula', unit: 'U2', topic: 'ad-as', topicZh: '总需求与总供给', kind: 'fill',
    prompt: 'Complete the formula: AD = C + I + G + (X − ___).', promptZh: '完成总需求公式。',
    accepted: ['m', 'imports'], answerDisplay: 'M', hint: 'Net trade equals exports minus imports.',
    keywords: [['exports', '出口'], ['imports', '进口']], explanationZh: 'AD = C + I + G + (X − M)。M 代表 imports，进口支出流向国外，因此从总需求中扣除。',
  },
  {
    id: 'u2-ad-rate', unit: 'U2', topic: 'ad-as', topicZh: '总需求与总供给', kind: 'choice',
    prompt: 'A fall in interest rates is most likely to...', promptZh: '利率下降最可能产生什么影响？',
    options: ['reduce consumption and investment', 'increase consumption and investment, shifting AD right', 'shift LRAS left immediately'],
    answerIndex: 1, answerDisplay: 'increase C and I, shifting AD right', hint: 'Borrowing becomes cheaper and saving becomes less attractive.',
    keywords: [['interest rates', '利率'], ['shift AD right', '总需求右移']], explanationZh: '利率下降降低借贷成本，通常刺激消费和投资，使 AD 向右移动。',
  },
  {
    id: 'u2-sras-cost', unit: 'U2', topic: 'ad-as', topicZh: '总需求与总供给', kind: 'choice',
    prompt: 'A sharp rise in oil prices is most likely to shift SRAS...', promptZh: '石油价格大幅上涨最可能使短期总供给怎样移动？',
    options: ['right', 'left', 'along the same curve'], answerIndex: 1, answerDisplay: 'left', hint: 'Oil is an important production cost.',
    keywords: [['SRAS', '短期总供给'], ['production cost', '生产成本']], explanationZh: '石油价格上涨提高大量企业的生产成本，使短期总供给左移，可能造成成本推动型通胀。',
  },
  {
    id: 'u2-lras', unit: 'U2', topic: 'ad-as', topicZh: '总需求与总供给', kind: 'choice',
    prompt: 'An improvement in labour productivity is most likely to...', promptZh: '劳动生产率提高最可能导致什么？',
    options: ['shift LRAS right', 'shift AD left', 'reduce productive capacity'], answerIndex: 0, answerDisplay: 'shift LRAS right', hint: 'The economy can produce more with its resources.',
    keywords: [['productivity', '生产率'], ['productive capacity', '生产能力']], explanationZh: '生产率提高会扩大经济的潜在生产能力，因此长期总供给向右移动。',
  },
  {
    id: 'u2-negative-gap', unit: 'U2', topic: 'ad-as', topicZh: '总需求与总供给', kind: 'fill',
    prompt: 'When actual output is below potential output, there is a negative output ______.', promptZh: '实际产出低于潜在产出时，存在负产出什么？',
    accepted: ['gap'], answerDisplay: 'gap', hint: 'Three letters.',
    keywords: [['actual output', '实际产出'], ['potential output', '潜在产出']], explanationZh: 'Negative output gap 表示经济产出低于潜在水平，通常伴随闲置产能和周期性失业。',
  },
  {
    id: 'u2-injection', unit: 'U2', topic: 'national-income', topicZh: '国民收入与乘数', kind: 'choice',
    prompt: 'Which is an injection into the circular flow of income?', promptZh: '哪一项是收入循环流动中的注入？',
    options: ['saving', 'taxation', 'investment'], answerIndex: 2, answerDisplay: 'investment', hint: 'Injections are I, G and X.',
    keywords: [['injection', '注入'], ['investment', '投资']], explanationZh: '投资、政府支出和出口是注入；储蓄、税收和进口是漏出。',
  },
  {
    id: 'u2-multiplier', unit: 'U2', topic: 'national-income', topicZh: '国民收入与乘数', kind: 'fill',
    prompt: 'If MPC = 0.75, calculate the multiplier using 1 ÷ (1 − MPC).', promptZh: '若 MPC = 0.75，使用公式计算乘数。',
    accepted: ['4', '4.0', '4.00'], answerDisplay: '4', hint: '1 ÷ 0.25 = ?',
    keywords: [['MPC', '边际消费倾向'], ['multiplier', '乘数']], explanationZh: 'Multiplier = 1 ÷ (1 − 0.75) = 1 ÷ 0.25 = 4。初始支出增加 1 单位，最终国民收入可能增加 4 单位。',
  },
  {
    id: 'u2-fiscal', unit: 'U2', topic: 'policy', topicZh: '宏观政策', kind: 'choice',
    prompt: 'Fiscal policy uses changes in...', promptZh: '财政政策主要使用什么工具？',
    options: ['taxation and government spending', 'interest rates and money supply only', 'wage negotiations only'],
    answerIndex: 0, answerDisplay: 'taxation and government spending', hint: 'It is controlled mainly by the government.',
    keywords: [['fiscal policy', '财政政策'], ['taxation', '税收'], ['government spending', '政府支出']], explanationZh: '财政政策是政府通过税收、政府支出和借款影响经济活动。利率属于货币政策工具。',
  },
  {
    id: 'u2-monetary', unit: 'U2', topic: 'policy', topicZh: '宏观政策', kind: 'fill',
    prompt: 'The base interest rate is a key tool of ______ policy.', promptZh: '基准利率是哪一种政策的主要工具？',
    accepted: ['monetary', 'monetary policy'], answerDisplay: 'monetary', hint: 'It is usually conducted by the central bank.',
    keywords: [['interest rate', '利率'], ['monetary policy', '货币政策']], explanationZh: '中央银行通过基准利率、货币供应量等工具实施 monetary policy。',
  },
  {
    id: 'u2-supply-side', unit: 'U2', topic: 'policy', topicZh: '宏观政策', kind: 'choice',
    prompt: 'The main aim of supply-side policy is to...', promptZh: '供给侧政策的主要目标是什么？',
    options: ['increase long-run productive capacity', 'reduce every price by law', 'increase imports only'],
    answerIndex: 0, answerDisplay: 'increase long-run productive capacity', hint: 'Think about LRAS.',
    keywords: [['supply-side policy', '供给侧政策'], ['productive capacity', '生产能力']], explanationZh: '供给侧政策通过改善生产率、劳动技能、竞争或基础设施，提高长期生产能力，使 LRAS 右移。',
  },
];

function checksum(value: string) {
  return [...value].reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

function choiceOptions(correct: string, alternatives: string[], seed: string) {
  const distinct = alternatives.filter((item) => item !== correct);
  const chosen = [correct, distinct[checksum(seed) % distinct.length], distinct[(checksum(seed) + 7) % distinct.length]];
  const unique = [...new Set(chosen)];
  while (unique.length < 3) unique.push(`None of these (${unique.length})`);
  const rotation = checksum(`${seed}:rotate`) % unique.length;
  const options = [...unique.slice(rotation), ...unique.slice(0, rotation)];
  return { options, answerIndex: options.indexOf(correct) };
}

const generatedConceptQuestions: Question[] = concepts.flatMap((concept) => {
  const peerTerms = concepts.filter((item) => item.topic === concept.topic).map((item) => item.termEn);
  const recognition = choiceOptions(concept.termEn, peerTerms, `${concept.id}:recognise`);
  const application = choiceOptions(concept.termEn, peerTerms, `${concept.id}:apply`);
  const firstLetter = concept.termEn[0]?.toUpperCase() ?? '';

  return [
    {
      id: `${concept.id}:recognise`, unit: concept.unit, topic: concept.topic, topicZh: concept.topicZh, kind: 'choice' as const,
      conceptId: concept.id, stage: 'recognise' as const,
      prompt: `Which economic term matches this definition? ${concept.definitionEn}`,
      promptZh: `哪一个经济学术语符合这个定义？${concept.explanationZh}`,
      options: recognition.options, answerIndex: recognition.answerIndex, answerDisplay: concept.termEn,
      hint: `先找定义中的主体、变化方向和关键词。中文术语是“${concept.termZh}”。`,
      keywords: [['definition', '定义'], ['economic term', '经济学术语']],
      explanationZh: `正确术语是 ${concept.termEn}（${concept.termZh}）。${concept.explanationZh}`,
    },
    {
      id: `${concept.id}:recall`, unit: concept.unit, topic: concept.topic, topicZh: concept.topicZh, kind: 'fill' as const,
      conceptId: concept.id, stage: 'recall' as const,
      prompt: `Write the English economic term: ${concept.definitionEn}`,
      promptZh: `根据定义填写英文经济学术语：${concept.termZh}。`,
      accepted: [concept.termEn, concept.termEn.replaceAll('-', ' ')], answerDisplay: concept.termEn,
      hint: `答案首字母是 ${firstLetter}，共 ${concept.termEn.split(/\s+/).length} 个单词。`,
      keywords: [[`starts with ${firstLetter}`, `首字母 ${firstLetter}`], ['recall', '回忆术语']],
      explanationZh: `完整英文术语是 ${concept.termEn}。${concept.explanationZh}`,
    },
    {
      id: `${concept.id}:apply`, unit: concept.unit, topic: concept.topic, topicZh: concept.topicZh, kind: 'choice' as const,
      conceptId: concept.id, stage: 'apply' as const,
      prompt: `Which concept best applies to this situation? ${concept.exampleEn ?? concept.definitionEn}`,
      promptZh: `下列情境主要体现哪一个概念？${concept.exampleZh ?? concept.explanationZh}`,
      options: application.options, answerIndex: application.answerIndex, answerDisplay: concept.termEn,
      hint: `先判断情境描述的是定义、原因、结果还是政策工具。`,
      keywords: [['situation', '情境'], ['apply', '应用']],
      explanationZh: `这个情境对应 ${concept.termEn}（${concept.termZh}）。${concept.explanationZh}`,
    },
  ];
});

export const questions: Question[] = [...generatedConceptQuestions, ...foundationQuestions];

export function correctAnswer(question: Question) {
  if (question.kind === 'choice' && question.options && question.answerIndex !== undefined) {
    return question.options[question.answerIndex];
  }
  return question.answerDisplay;
}
