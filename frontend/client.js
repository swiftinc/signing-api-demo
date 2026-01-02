let sessionId = null;
let txDigest = null;
let verificationCode = null;

function logout() {
  sessionStorage.clear();
  window.location = "login.html";
}

function setView() {
  if (!sessionStorage.getItem("userId")) {
    window.location = "login.html";
  }

  if (sessionId != null) {
    document.getElementById("sessionId").innerHTML = sessionId;
    document.getElementById("verificationCode").innerHTML = verificationCode;
    document.getElementById("formdiv").style.display = "none";
    document.getElementById("txdiv").style.display = "block";
    if (verificationCode != null && verificationCode != "") {
      document.getElementById("vcdiv").style.display = "block";
    } else {
      document.getElementById("vcdiv").style.display = "none";
    }
    setTimeout(pollStatus, 5000);
  } else {
    document.getElementById("sessionId").innerHTML = sessionId;
    document.getElementById("verificationCode").innerHTML = verificationCode;
    document.getElementById("formdiv").style.display = "block";
    document.getElementById("txdiv").style.display = "none";
  }
}

function reset() {
  sessionId = null;
  txDigest = null;
  verificationCode = null;

  document.getElementById("errorendresult").innerHTML = "";
  document.getElementById("errordetails").innerHTML = "";
  document.getElementById("successdiv").style.display = "none";
  document.getElementById("pendingdiv").style.display = "block";
  document.getElementById("errordiv").style.display = "none";
  document.getElementById("txdiv").style.display = "none";

  document.getElementById("formdiv").style.display = "block";
  setView();
}

function toggleDiv(id) {
  var txId = document.getElementById(id);
  if (txId.style.display === "none") {
    txId.style.display = "block";
    if (id === "certdiv") {
      document.getElementById("certbutton").innerHTML = "Hide Certificate";
    }
    if (id === "sigdiv") {
      document.getElementById("sigbutton").innerHTML = "Hide Signature";
    }
  } else {
    txId.style.display = "none";
    if (id === "certdiv") {
      document.getElementById("certbutton").innerHTML = "Show Certificate";
    }
    if (id === "sigdiv") {
      document.getElementById("sigbutton").innerHTML = "Show Signature";
    }
  }
}

document.getElementById("sigForm").addEventListener("submit", function (e) {
  e.preventDefault(); //to prevent form submission
  submitForSignature();
});

async function hash(string) {
  const utf8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest("SHA-256", utf8);

  return btoa(String.fromCharCode.apply(null, new Uint8Array(hashBuffer)));
}

function printStringOrArray(value) {
  if (typeof value === "string") {
    return value;
  } else if (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  ) {
    return value.join(", "); // Print array elements separated by commas
  } else {
    console.log("The value is not a string or a string array.");
  }
}

async function submitForSignature() {
  let corpId = document.forms["sigForm"]["approverSelection"].value;
  let bic = document.forms["sigForm"]["bic8"].value;
  let service = document.title;
  let userPreferredMethod = "SSSKEY_DIGITAL";
  let requiredSecurityLevel = document.forms["sigForm"]["flowSelection"].value;
  let message = document.forms["sigForm"]["message"].value;
  let digest = document.forms["sigForm"]["digest"].value;
  let alg = document.forms["sigForm"]["alg"].value;
  let batchSize = document.forms["sigForm"]["batchSize"].value;

  let digestAlg;
  if (digest != null && digest != "" && digest != "Optional") {
    txDigest = digest;
    digestAlg = alg;
  } else {
    txDigest = await hash(message);
    digestAlg = "SHA256";
  }

  let digestList = [txDigest];
  for (let i = 1; i < batchSize; i++) {
    // Batch needs unique digests, so compute digests based on i
    digestList.push(await hash(i));
  }

  // const vals = [corpId, bic, service, userPreferredMethod, requiredSecurityLevel, message, txDigest, digestAlg];
  // vals.forEach(function (e) {console.log(e)});

  if (
    corpId === "" ||
    bic === "" ||
    requiredSecurityLevel === "" ||
    message === ""
  ) {
    alert("Approver ID, BIC, Flow, and Message must be filled out");
    return false;
  }

  let requestBody = {
    requesterBic: bic,
    requesterService: service,
    userId: corpId,
    digest: digestList,
    digestAlg: digestAlg,
    userPreferredMethod: userPreferredMethod,
    requiredSecurityLevel: requiredSecurityLevel,
    message: message,
  };

  console.log("Request body: " + JSON.stringify(requestBody));

  let signUri = "/api/sign";

  $.ajax({
    async: true,
    url: signUri,
    type: "post",
    data: JSON.stringify(requestBody),
    contentType: "application/json; charset=utf-8",
    traditional: true,
    success: function (data) {
      console.log(data);
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch (e) {
          console.debug("Data is not a JSON string.");
        }
      }

      if (data["state"] === "PENDING") {
        sessionId = data["sessionId"];
        verificationCode = data["verificationCode"];
        document.getElementById("status").innerHTML = "Pending...";
        setView();
      } else {
        document.getElementById("errorendresult").innerHTML = "ERROR";
        if (data["result"] != undefined) {
          document.getElementById("errordetails").innerHTML = data["result"];
        } else if (data["text"] != undefined) {
          document.getElementById("errordetails").innerHTML = data["text"];
        } else {
          document.getElementById("errordetails").innerHTML =
            "See web application logs for details.";
        }
        document.getElementById("successdiv").style.display = "none";
        document.getElementById("pendingdiv").style.display = "none";
        document.getElementById("errordiv").style.display = "block";

        document.getElementById("formdiv").style.display = "none";
        document.getElementById("txdiv").style.display = "block";
      }
    },
    error: function (xhr, status, error) {
      console.log(error);
    },
  });
}

function pollStatus() {
  let statusUri = "/api/status/" + sessionId;
  $.ajax({
    async: true,
    url: statusUri,
    type: "get",
    traditional: true,
    success: function (data) {
      console.log(data);
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch (e) {
          console.debug("Data is not a JSON string.");
        }
      }

      if (data["state"] === "COMPLETE") {
        if (data["result"] === "OK") {
          document.getElementById("status").innerHTML = "COMPLETE";
          document.getElementById("successendresult").innerHTML = "OK";
          document.getElementById("signature").innerHTML = printStringOrArray(
            data["signature"]
          );
          document.getElementById("cert").innerHTML = data["certificate"];
          document.getElementById("dn").innerHTML = data["dn"];
          document.getElementById("errordiv").style.display = "none";
          document.getElementById("pendingdiv").style.display = "none";
          document.getElementById("successdiv").style.display = "block";
        } else {
          document.getElementById("errorendresult").innerHTML = "ERROR";
          if (data["result"] != undefined) {
            document.getElementById("errordetails").innerHTML = data["result"];
          } else if (data["text"] != undefined) {
            document.getElementById("errordetails").innerHTML = data["text"];
          } else {
            document.getElementById("errordetails").innerHTML =
              "See web application logs for details.";
          }
          document.getElementById("successdiv").style.display = "none";
          document.getElementById("pendingdiv").style.display = "none";
          document.getElementById("errordiv").style.display = "block";
        }
      } else {
        document.getElementById("status").innerHTML = "Still Pending...";
        document.getElementById("successdiv").style.display = "none";
        document.getElementById("errordiv").style.display = "none";
        document.getElementById("pendingdiv").style.display = "block";

        setTimeout(pollStatus, 5000);
      }
    },
    error: function (xhr, status, error) {
      console.log(error);
    },
  });
}
