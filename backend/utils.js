import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import got from "got";

dotenv.config();
const privateKeyPath = process.env.SWIFT_PRIVATE_KEY;
const certPath = process.env.SWIFT_CERTIFICATE;
const username = process.env.CLIENT_ID;
const password = process.env.CLIENT_SECRET;
const swiftApiHost = process.env.SWIFT_API_HOST;
const swiftCertDn = process.env.SWIFT_CERTIFICATE_DN;

function createBasicAuthHeader() {
  const credentials = `${username}:${password}`;
  const encodedCredentials = btoa(credentials);
  return `Basic ${encodedCredentials}`;
}

async function createJWTAssertion() {
  const X5C_HEADER = "-----BEGIN CERTIFICATE-----";
  const X5C_FOOTER = "-----END CERTIFICATE-----";

  // Get the keys from files
  const pkcs8PEM = fs.readFileSync(privateKeyPath).toString();
  const key = crypto.createPrivateKey({ key: pkcs8PEM });
  var certPEM = fs.readFileSync(certPath).toString();

  //Check and format the Entry
  if (!certPEM.startsWith(X5C_HEADER)) {
    throw new Error(
      "Your 'publicKey' (Public Certificate) is missing the header '" +
        X5C_HEADER +
        "' + [new line]"
    );
  }
  certPEM = certPEM.substring(X5C_HEADER.length);
  certPEM = certPEM.replace(/(\r\n|\n|\r)/gm, "");

  if (!certPEM.endsWith(X5C_FOOTER)) {
    throw new Error(
      "Your 'publicKey' (Public Certificate) is missing the footer [new line] + '" +
        X5C_FOOTER +
        "'"
    );
  }
  certPEM = certPEM.substring(0, certPEM.length - X5C_FOOTER.length);

  // Constructing the signed jwt
  var x5c = [certPEM];

  // create the header: including type, algorithm, and certificate chain
  var header = {
    typ: "JWT",
    alg: "RS256",
    x5c: x5c,
  };

  // create the jti
  var newJti = "";
  var charset = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < 12; i++) {
    newJti += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  // get the current time to put in the payload
  var currentTime = +new Date();
  var issuedAtTimeSeconds = currentTime / 1000;
  var expirationTimeSeconds = currentTime / 1000 + 700;

  //create a iss :
  var clientID = username;

  // create the payload
  var payload = {
    iss: clientID,
    aud: swiftApiHost + "/oauth2/v1/token",
    sub: swiftCertDn,
    jti: newJti,
    exp: Math.ceil(expirationTimeSeconds),
    iat: Math.ceil(issuedAtTimeSeconds),
  };

  // sign the jwt
  const jwt_token = jwt.sign(payload, key, {
    algorithm: "RS256",
    header: header,
  });
  // console.log("Created JWT assertion: " + jwt_token);
  return jwt_token;
}

export async function getOauthToken() {
  console.log("Called get-oauth-token");

  const options = {
    headers: {
      "X-SRCNW": "INTERNET",
      Accept: "application/json",
      Authorization: createBasicAuthHeader(),
    },
    form: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: await createJWTAssertion(),
      scope: "3skey",
    },
    method: "POST",
    followRedirect: true,
  };
  //console.log(options);

  try {
    const data = await got(
      "https://" + swiftApiHost + "/oauth2/v1/token",
      options
    ).json();
    // console.log("Token received: " + data["access_token"]);
    return data["access_token"];
  } catch (e) {
    if (
      e.response &&
      e.response.statusCode >= 400 &&
      e.response.statusCode < 600
    ) {
      // Handle 4XX/5XX error
      console.error(e.response.statusCode + " Error:" + e.response.body);
      return null;
    } else {
      // Handle other errors
      console.log(e);
      throw e;
    }
  }
}

export async function deleteOauthToken(token) {
  // console.log("Called delete-oauth-token for " + token);

  const options = {
    headers: {
      Authorization: createBasicAuthHeader(),
    },
    form: {
      token: token,
    },
    method: "POST",
    followRedirect: true,
  };
  // console.log(options);

  try {
    await got("https://" + swiftApiHost + "/oauth2/v1/revoke", options);
    console.log("Token deleted");
  } catch (e) {
    if (
      e.response &&
      e.response.statusCode >= 400 &&
      e.response.statusCode < 600
    ) {
      // Handle 4XX/5XX error
      console.error(e.response.statusCode + " Error:" + e.response.body);
      return null;
    } else {
      // Handle other errors
      console.log(e);
      throw e;
    }
  }
}

function generateRandomString(length) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

export async function generateRandomSHA256Hash() {
  const randomString = generateRandomString(32);
  const hash = await generateHash(randomString);
  console.log("Generated hash: " + hash + ", from data : " + randomString);
  return { hash: hash, randomString: randomString };
}

export async function generateHash(string) {
  const hash = crypto.createHash("sha256");
  hash.update(string, "utf8");
  const hashBuffer = hash.digest();
  return hashBuffer.toString("base64");
}

export function checkCertificateExpiration(certificate) {
  const certHeader = "-----BEGIN CERTIFICATE-----\n";
  const certFooter = "\n-----END CERTIFICATE-----";
  const cert = certHeader + certificate + certFooter;

  const { validTo } = new crypto.X509Certificate(cert);

  const now = new Date();
  const expirationDate = new Date(validTo);

  if (now > expirationDate) {
    console.log("Certificate has expired.");
    return true;
  } else {
    console.log("Certificate is still valid until: " + validTo);
    return false;
  }
}

export function verifySignature(signature, certificate, data) {
  const certHeader = "-----BEGIN CERTIFICATE-----\n";
  const certFooter = "\n-----END CERTIFICATE-----";
  const cert = certHeader + certificate + certFooter;

  let publicKey = crypto.createPublicKey({
    key: cert,
    format: "pem",
  });

  let dataBuffer = Buffer.from(data);
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(dataBuffer);
  const isValid = verifier.verify(publicKey, signature, "base64");

  if (isValid) {
    console.log("Signature is valid");
  } else {
    console.log("Signature is invalid!");
  }
  return isValid;
}
