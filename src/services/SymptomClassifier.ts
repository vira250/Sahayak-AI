export interface SymptomClassification {
  detected: boolean;
  condition:
    | 'cold_like_illness'
    | 'heart_attack_warning'
    | 'stroke_warning'
    | 'respiratory_distress'
    | 'severe_bleeding'
    | 'injury_cut_wound'
    | 'injury_burn'
    | 'injury_bruise_soft_tissue'
    | 'injury_fracture_suspected'
    | 'injury_skin_bite_rash'
    | 'general_symptom'
    | null;
  confidence: number;
  matchedSymptoms: string[];
  emergency: boolean;
  emergencyReason?: string;
}

const includesAny = (text: string, phrases: string[]): string[] => {
  return phrases.filter((phrase) => text.includes(phrase));
};

const hasNegation = (text: string, phrase: string): boolean => {
  const negations = ['no ', 'not ', 'without ', 'denies '];
  return negations.some((neg) => text.includes(`${neg}${phrase}`));
};

export const classifySymptomText = (rawText: string): SymptomClassification => {
  const normalized = rawText.toLowerCase();
  const text = normalized.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  if (!text) {
    return {
      detected: false,
      condition: null,
      confidence: 0,
      matchedSymptoms: [],
      emergency: false,
    };
  }

  const coldSymptoms = includesAny(text, [
    'cold',
    'cough',
    'sore throat',
    'runny nose',
    'sneezing',
    'mild fever',
    'congestion',
  ]).filter((sym) => !hasNegation(text, sym));

  const heartSymptoms = includesAny(text, [
    'chest pain',
    'chest pressure',
    'left arm pain',
    'jaw pain',
    'shortness of breath',
    'sweating',
    'nausea',
    'heart attack',
    'heartattack',
  ]).filter((sym) => !hasNegation(text, sym));

  const strokeSymptoms = includesAny(text, [
    'face droop',
    'slurred speech',
    'arm weakness',
    'sudden confusion',
    'stroke',
  ]).filter((sym) => !hasNegation(text, sym));

  const respiratorySymptoms = includesAny(text, [
    'breathing difficulty',
    'cant breathe',
    'cannot breathe',
    'breathless',
    'wheezing',
  ]).filter((sym) => !hasNegation(text, sym));

  const bleedingSymptoms = includesAny(text, [
    'severe bleeding',
    'bleeding heavily',
    'blood wont stop',
    'blood will not stop',
    'hemorrhage',
  ]).filter((sym) => !hasNegation(text, sym));

  const cutWoundSymptoms = includesAny(text, [
    'cut',
    'cuts',
    'laceration',
    'wound',
    'open wound',
    'gash',
    'abrasion',
    'scrape',
  ]).filter((sym) => !hasNegation(text, sym));

  const burnSymptoms = includesAny(text, [
    'burn',
    'burned',
    'burnt',
    'blister',
    'scald',
    'thermal injury',
  ]).filter((sym) => !hasNegation(text, sym));

  const bruiseSymptoms = includesAny(text, [
    'bruise',
    'bruises',
    'bruising',
    'contusion',
    'swelling',
    'swollen',
  ]).filter((sym) => !hasNegation(text, sym));

  const fractureSymptoms = includesAny(text, [
    'fracture',
    'broken bone',
    'sprain',
    'cannot move',
    'cant move',
    'deformity',
  ]).filter((sym) => !hasNegation(text, sym));

  const skinBiteSymptoms = includesAny(text, [
    'bite',
    'insect bite',
    'rash',
    'hives',
    'skin infection',
    'boil',
  ]).filter((sym) => !hasNegation(text, sym));

  const explicitColdMention = !hasNegation(text, 'cold') && (text.includes('cold') || text.includes('common cold'));
  const explicitHeartAttackMention =
    !hasNegation(text, 'heart attack') && (text.includes('heart attack') || normalized.includes('heartattack'));

  const severeTraumaIndicators = includesAny(text, [
    'deep cut',
    'heavy bleeding',
    'severe burn',
    'third degree burn',
    'open fracture',
    'bone visible',
  ]).filter((sym) => !hasNegation(text, sym));

  if (
    explicitHeartAttackMention ||
    heartSymptoms.length >= 2 ||
    strokeSymptoms.length >= 2 ||
    respiratorySymptoms.length >= 1 ||
    bleedingSymptoms.length >= 1 ||
    severeTraumaIndicators.length >= 1
  ) {
    const matched = [
      ...heartSymptoms,
      ...strokeSymptoms,
      ...respiratorySymptoms,
      ...bleedingSymptoms,
      ...severeTraumaIndicators,
    ];
    let condition: SymptomClassification['condition'] = 'general_symptom';
    let reason = 'Potential emergency signs detected';

    if (explicitHeartAttackMention || heartSymptoms.length >= 2) {
      condition = 'heart_attack_warning';
      reason = 'Possible cardiac emergency signs detected';
    } else if (strokeSymptoms.length >= 2) {
      condition = 'stroke_warning';
      reason = 'Possible stroke signs detected';
    } else if (respiratorySymptoms.length >= 1) {
      condition = 'respiratory_distress';
      reason = 'Breathing distress indicators detected';
    } else if (bleedingSymptoms.length >= 1) {
      condition = 'severe_bleeding';
      reason = 'Severe bleeding indicators detected';
    } else if (severeTraumaIndicators.length >= 1) {
      condition = 'injury_cut_wound';
      reason = 'Severe trauma indicators detected';
    }

    return {
      detected: true,
      condition,
      confidence: 0.85,
      matchedSymptoms: explicitHeartAttackMention ? [...matched, 'heart attack'] : matched,
      emergency: true,
      emergencyReason: reason,
    };
  }

  if (explicitColdMention || coldSymptoms.length >= 2) {
    return {
      detected: true,
      condition: 'cold_like_illness',
      confidence: coldSymptoms.length >= 2 ? 0.74 : 0.62,
      matchedSymptoms: coldSymptoms.length > 0 ? coldSymptoms : ['cold'],
      emergency: false,
    };
  }

  if (cutWoundSymptoms.length >= 1) {
    return {
      detected: true,
      condition: 'injury_cut_wound',
      confidence: 0.72,
      matchedSymptoms: cutWoundSymptoms,
      emergency: false,
    };
  }

  if (burnSymptoms.length >= 1) {
    return {
      detected: true,
      condition: 'injury_burn',
      confidence: 0.72,
      matchedSymptoms: burnSymptoms,
      emergency: false,
    };
  }

  if (bruiseSymptoms.length >= 1) {
    return {
      detected: true,
      condition: 'injury_bruise_soft_tissue',
      confidence: 0.69,
      matchedSymptoms: bruiseSymptoms,
      emergency: false,
    };
  }

  if (fractureSymptoms.length >= 1) {
    return {
      detected: true,
      condition: 'injury_fracture_suspected',
      confidence: 0.78,
      matchedSymptoms: fractureSymptoms,
      emergency: fractureSymptoms.some((s) => s.includes('deformity') || s.includes('broken bone')),
      emergencyReason: fractureSymptoms.some((s) => s.includes('deformity') || s.includes('broken bone'))
        ? 'Possible fracture emergency indicators detected'
        : undefined,
    };
  }

  if (skinBiteSymptoms.length >= 1) {
    return {
      detected: true,
      condition: 'injury_skin_bite_rash',
      confidence: 0.66,
      matchedSymptoms: skinBiteSymptoms,
      emergency: false,
    };
  }

  const generalSymptoms = includesAny(text, [
    'fever',
    'pain',
    'headache',
    'dizzy',
    'vomiting',
    'weakness',
    'injury',
  ]).filter((sym) => !hasNegation(text, sym));

  if (generalSymptoms.length > 0) {
    return {
      detected: true,
      condition: 'general_symptom',
      confidence: 0.58,
      matchedSymptoms: generalSymptoms,
      emergency: false,
    };
  }

  return {
    detected: false,
    condition: null,
    confidence: 0,
    matchedSymptoms: [],
    emergency: false,
  };
};
