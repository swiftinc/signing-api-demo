let sessionId = null;
let txDigest = null;
let verificationCode = null;

$(document).ready(function () {
  $("#but_submit").click(function () {
    var username = $("#txt_uname").val().trim();

    if (username != "") {
      console.log("Starting authentication for " + username);
      submitForAuthentication(username);
    }
  });
});

function submitForAuthentication(userId) {
  let uri = "/api/auth";
  let requestBody = { userId: userId };

  $.ajax({
    async: true,
    url: uri,
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
        if (verificationCode === "") {
          msg = "Waiting for approval...";
        } else {
          msg = "Waiting for approval...";
          $("#details").html("Verification Code: " + verificationCode);
        }
        $("#message").html(msg);
        setTimeout(pollStatus(userId), 15000);
      } else {
        msg = "Login request Failed.";
        $("#message").html(msg);
        if ("result" in data) {
          $("#details").html("Code: " + data["result"]);
        } else if ("text" in data) {
          $("#details").html(data["text"]);
        } else {
          $("#details").html("See web application log for details.");
        }
      }
    },
    error: function (xhr, status, error) {
      console.log("Error HTTP code: " + xhr.status);
      console.log("Error HTTP body: " + xhr.responseText);
      console.log("Error - Full: " + error);
    },
  });
}

function pollStatus(userId) {
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
          sessionStorage.setItem("userId", userId);
          window.location = "index.html";
        } else {
          msg = "Login request failed.";
          $("#message").html(msg);

          if (data["result"] !== undefined) {
            $("#details").html("Code: " + data["result"]);
          } else if (data["text"] !== undefined) {
            $("#details").html(data["text"]);
          } else {
            $("#details").html("See web application log for details.");
          }
        }
      } else {
        setTimeout(pollStatus(userId), 10000);
      }
    },
    error: function (xhr, status, error) {
      console.log(error);
    },
  });
}
