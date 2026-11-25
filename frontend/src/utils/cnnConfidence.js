export const formatCnnConfidence = (confidence) => {
  if (
    (typeof confidence !== 'number' && typeof confidence !== 'string')
    || (typeof confidence === 'string' && !confidence.trim())
  ) {
    return 'Not available';
  }

  const score = Number(confidence);
  if (!Number.isFinite(score) || score < 0 || score > 1) return 'Not available';
  return `${(score * 100).toFixed(2)}% CNN Confidence`;
};
