export function getCreatorDisplayName(record) {
  const creatorName = String(
    record?.Creator?.name ||
    record?.createdByName ||
    record?.creatorName ||
    record?.createdBy?.name ||
    ''
  ).trim();
  if (creatorName) return creatorName;

  const creatorEmail = String(record?.Creator?.email || record?.createdBy?.email || '').trim();
  if (creatorEmail) return creatorEmail;

  const creatorId = String(record?.createdBy?.id || record?.createdBy || '').trim();
  if (creatorId) return creatorId;

  return '-';
}

export function getCurrentCreatorValue(user) {
  return [
    user?.id,
    user?._id,
    user?.userId,
    user?.email,
    user?.name,
  ]
    .map((value) => String(value || '').trim())
    .find(Boolean) || '';
}
