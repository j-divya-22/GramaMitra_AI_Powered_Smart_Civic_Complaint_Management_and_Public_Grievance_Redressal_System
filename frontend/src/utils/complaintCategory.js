export const COMPLAINT_CATEGORY_LABELS = {
  damaged_footpath: 'Damaged Footpath',
  damaged_road_sign: 'Damaged or Missing Road Sign',
  electrical_hazard: 'Loose / Open Electric Wires',
  infrastructure: 'Damaged Public Infrastructure',
  normal: 'No Civic Issue',
  open_manhole_borewell: 'Open Manhole / Borewell / Deep Hole',
  road_damage: 'Damaged Road / Holes on Road',
  roadside_garbage: 'Garbage on Roadside / Public Places',
  streetlight_faults: 'Streetlight Not Working',
  vegetation: 'Overgrown Trees / Bushes / Plants',
  waterlogging: 'Waterlogging / Flooded Road',
  other: 'Other',
  needs_review: 'Needs review',
  needs_verification: 'Needs verification',
};

export const getComplaintCategoryLabel = (category) => {
  if (typeof category !== 'string' || !category.trim()) return 'Uncategorized';
  if (COMPLAINT_CATEGORY_LABELS[category]) return COMPLAINT_CATEGORY_LABELS[category];
  return category
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const getCitizenComplaintCategoryLabel = (category) => {
  if (typeof category !== 'string' || !category.trim()) return 'Uncategorized';
  return getComplaintCategoryLabel(category);
};

export const isReviewCategory = (category) => (
  category === 'needs_review' || category === 'needs_verification'
);

export const summarizeImagePredictions = (predictions) => {
  if (!predictions.length) {
    return { category: null, needsReview: false, reason: null };
  }

  const classes = new Set(predictions.map((item) => item.prediction));
  if (classes.size === 1 && classes.has('normal')) {
    return { category: 'normal', needsReview: true, reason: 'no_issue_detected' };
  }
  if (classes.size !== 1) {
    return { category: 'needs_review', needsReview: true, reason: 'conflicting_predictions' };
  }
  if (predictions.some((item) => item.needs_review)) {
    return {
      category: 'needs_review',
      needsReview: true,
      reason: predictions.find((item) => item.review_reason)?.review_reason || 'requires_review',
    };
  }
  return { category: predictions[0].prediction, needsReview: false, reason: null };
};
