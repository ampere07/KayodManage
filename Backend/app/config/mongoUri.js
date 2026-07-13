function getMongoUri() {
  let uri = process.env.MONGODB_URI;

  if (!uri || !uri.includes("mongodb+srv://")) return uri;

  const match = uri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)/);
  if (!match) return uri;

  const [, rawUser, rawPass] = match;
  const user = encodeURIComponent(rawUser);
  const pass = encodeURIComponent(rawPass);
  const hosts = [
    "ac-qnrdto4-shard-00-00.30yt5b2.mongodb.net:27017",
    "ac-qnrdto4-shard-00-01.30yt5b2.mongodb.net:27017",
    "ac-qnrdto4-shard-00-02.30yt5b2.mongodb.net:27017",
  ].join(",");
  const originalParams = uri.includes("?")
    ? uri
        .split("?")[1]
        .replace(/retryWrites=[^&]*/g, "")
        .replace(/w=[^&]*/g, "")
        .replace(/&&+/g, "&")
        .replace(/&$/, "")
        .replace(/^&/, "")
    : "";
  const queryParams = originalParams
    ? `${originalParams}&authSource=admin&tls=true`
    : "authSource=admin&tls=true";

  console.log("[MongoDB] Using direct hosts to bypass SRV DNS lookup");
  return `mongodb://${user}:${pass}@${hosts}/?${queryParams}`;
}

module.exports = { getMongoUri };
