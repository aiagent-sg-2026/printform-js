self.requireBuildIdentity = async function requireBuildIdentity(build, responsePromise) {
  const response = await responsePromise;
  if (!response || !response.ok) throw new Error("Build identity request failed");
  let identity;
  try { identity = await response.json(); } catch { throw new Error("Invalid build identity JSON"); }
  if (!identity || identity.build !== build) throw new Error("Build identity mismatch");
  return identity;
};
