import express from "express";
import dotenv from "dotenv";
import got from "got";
import {
  getOauthToken,
  deleteOauthToken,
  generateRandomSHA256Hash,
  generateHash,
  verifySignature,
  checkCertificateExpiration,
} from "./utils.js";

dotenv.config();
const app = express();
const port = process.env.PORT;
const swiftApiHost = process.env.SWIFT_API_HOST;

let currentReqData = {
  hash: null,
  data: null,
  session: null,
};

app.use(express.json());

// Test API for backend healthcheck
app.get("/api/test", (req, res) => {
  res.json({ message: "Hello from the Backend!" });
});

// Call Digital Token authentication API
app.post("/api/auth", async (req, res) => {
  console.log("Called auth");
  console.log(req.body);
  const bearerToken = await getOauthToken();
  if (bearerToken == null) {
    res.json({ result: "Backend error getting Oauth token" });
    return;
  }
  const corpId = req.body["userId"];

  const { hash, randomString } = await generateRandomSHA256Hash();
  currentReqData.hash = hash;
  currentReqData.data = randomString;

  let requestBody = {
    requester_bic: "TESTBIC8",
    requester_service: "Bank App Demo",
    user_id: corpId,
    challenge: hash,
    required_security_level: "EASY",
  };

  const options = {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer " + bearerToken,
    },
    json: requestBody,
    method: "POST",
    followRedirect: true,
  };
  console.log(options);

  try {
    const data = await got(
      "https://" +
        swiftApiHost +
        "/swift-token-management/v1/digital-token/authentication",
      options
    ).json();
    console.log(data);
    if (data.sessionId) currentReqData.session = data.sessionId;

    res.json(data);
  } catch (error) {
    if (error.response) {
      console.error("HTTP Error Status Code:", error.response.statusCode);
      console.error("HTTP Error Response Body:", error.response.body);
      if (error.response.body) {
        res.json(error.response.body);
      } else {
        res.json('{"error": "' + error.response.statusCode + ' Error"}');
      }
      res.status(error.response.statusCode);
    } else if (error.request) {
      console.error("Network Error:", error.message);
    } else {
      console.error("General Error:", error.message);
    }
  }

  await deleteOauthToken(bearerToken);
});

// Call Digital Token signing API
app.post("/api/sign", async (req, res) => {
  console.log("Called sign");
  console.log(req.body);
  const bearerToken = await getOauthToken();
  if (bearerToken == null) {
    res.json({ Error: "Backend error getting Oauth token" });
    return;
  }
  if (req.body.digest) currentReqData.hash = req.body.digest;
  // console.log("Digest of message: " + (await generateHash(req.body.message)));
  // console.log("Provided digest:   " + req.body.digest);
  if (
    req.body.digest &&
    req.body.message &&
    (await generateHash(req.body.message)) == req.body.digest
  ) {
    // We know the data behind the hash, so we can use this in verification
    currentReqData.data = req.body.message;
  } else {
    // We do not know the data behind the hash, so we cannot verify
    console.log(
      "Hash of message is not equal to the provided digest, must be custom digest. Won't be able to verify."
    );
    currentReqData.data = null;
  }

  let requestBody = {
    requester_bic: req.body.requesterBic,
    requester_service: req.body.requesterService,
    user_id: req.body.userId,
    digest: req.body.digest,
    digest_algorithm: req.body.digestAlg,
    user_preferred_method: req.body.userPreferredMethod,
    required_security_level: req.body.requiredSecurityLevel,
    message: req.body.message,
  };

  const options = {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer " + bearerToken,
    },
    json: requestBody,
    method: "POST",
    followRedirect: true,
  };
  console.log(options);

  try {
    const data = await got(
      "https://" +
        swiftApiHost +
        "/swift-token-management/v1/digital-token/signature",
      options
    ).json();
    console.log(data);
    if (data.sessionId) currentReqData.session = data.sessionId;

    res.json(data);
  } catch (error) {
    if (error.response) {
      console.error("HTTP Error Status Code:", error.response.statusCode);
      console.error("HTTP Error Response Body:", error.response.body);
      if (error.response.body) {
        res.json(error.response.body);
      } else {
        res.json('{"error": "' + error.response.statusCode + ' Error"}');
      }
      res.status(error.response.statusCode);
    } else if (error.request) {
      console.error("Network Error:", error.message);
    } else {
      console.error("General Error:", error.message);
    }
  }

  await deleteOauthToken(bearerToken);
});

// Call Digital Token status API
app.get("/api/status/:sessionId", async (req, res) => {
  console.log("Called status");
  const bearerToken = await getOauthToken();
  if (bearerToken == null) {
    res.json({ Error: "Backend error getting Oauth token" });
    return;
  }

  const sessionId = req.params.sessionId;
  const options = {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer " + bearerToken,
    },
    method: "GET",
    followRedirect: true,
  };

  try {
    const data = await got(
      "https://" +
        swiftApiHost +
        "/swift-token-management/v1/digital-token/" +
        sessionId,
      options
    ).json();
    console.log(data);

    if (
      sessionId == currentReqData.session &&
      data.signature &&
      data.certificate
    ) {
      // Check expiration
      console.log("Checking certificate expiration");
      checkCertificateExpiration(data.certificate);

      // TODO: Check data.certificate against Swift CRL

      // Verify signature
      console.log("Validating signature");
      console.log(currentReqData);
      if (currentReqData.data) {
        verifySignature(data.signature, data.certificate, currentReqData.data);
      } else {
        console.log("Don't have initial data to verify.");
      }

      // Reset currentReqData
      currentReqData.hash = null;
      currentReqData.session = null;
      currentReqData.data = null;
    }

    res.json(data);
  } catch (error) {
    if (error.response) {
      console.error("HTTP Error Status Code:", error.response.statusCode);
      console.error("HTTP Error Response Body:", error.response.body);
      if (error.response.body) {
        res.json(error.response.body);
      } else {
        res.json('{"error": "' + error.response.statusCode + ' Error"}');
      }
      res.status(error.response.statusCode);
    } else if (error.request) {
      console.error("Network Error:", error.message);
    } else {
      console.error("General Error:", error.message);
    }
  }

  await deleteOauthToken(bearerToken);
});

app.use(express.static("../frontend"));

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
