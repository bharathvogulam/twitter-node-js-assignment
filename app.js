const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const databasePath = path.join(__dirname, "twitterClone.db");

const initializeDbAndStartServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndStartServer();

const convertUserDbToResponse = (dbObject) => {
  return {
    userId: dbObject.user_id,
    name: dbObject.name,
    username: dbObject.username,
    password: dbObject.password,
    gender: dbObject.gender,
  };
};
const convertfollowerdbobjecttoresponse = (dbObject) => {
  return {
    followerId: dbObject.follower_id,
    followerUserId: dbObject.follower_user_id,
    followingUserId: dbObject.following_user_id,
  };
};
const convertTweetToResponse = (dbObject) => {
  return {
    tweetId: dbObject.tweet_id,
    tweet: dbObject.tweet,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  };
};
const convertReplyToResponse = (dbObject) => {
  return {
    replyId: dbObject.reply_id,
    tweetId: dbObject.tweet_id,
    reply: dbObject.reply,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  };
};
const convertLikesToResponse = (dbObject) => {
  return {
    likeId: dbObject.like_id,
    tweetId: dbObject.tweet_id,
    userId: dbObject.user_id,
    dateTime: dbObject.date_time,
  };
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getQuery = `
        SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await database.get(getQuery);
  if (dbUser) {
    response.status(400);
    response.send("User already exists");
  } else if (password.length < 6) {
    response.status(400);
    response.send("Password is too short");
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    const createdUser = `
        INSERT INTO user ( username, password, name, gender )
        VALUES ( '${username}', '${hashedPassword}', '${name}', '${gender}' );`;
    await database.run(createdUser);
    response.status(200);
    response.send("User created successfully");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUser = `
        SELECT * FROM user WHERE username='${username}';`;
  const dbuser = await database.get(getUser);
  if (!dbuser) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const ispasswordMatched = await bcrypt.compare(password, dbuser.password);
    if (ispasswordMatched) {
      const payload = { username };
      const jwtToken = jwt.sign(payload, "secret_key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateUser = (request, response, next) => {
  let jwtToken;
  let authHeader = request.headers["authorization"];
  if (!authHeader) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwtToken = authHeader.split(" ")[1];
    jwt.verify(jwtToken, "secret_key", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get("/user/tweets/feed/", authenticateUser, async (request, response) => {
  const { username } = request;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await database.get(selectUserQuery);
  const followingUsersQuery = `
    SELECT following_user_id FROM follower 
    WHERE follower_user_id = ${dbUser.user_id};
  `;
  const followingUsersObjectsList = await database.all(followingUsersQuery);
  const followingUsersList = followingUsersObjectsList.map((object) => {
    return object["following_user_id"];
  });
  const getTweetsQuery = `
  SELECT 
    user.username AS username, 
    tweet.tweet AS tweet, 
    tweet.date_time AS dateTime
  FROM 
    tweet 
    INNER JOIN user ON tweet.user_id = user.user_id 
  WHERE
    tweet.user_id IN (
        ${followingUsersList}
    )
  ORDER BY tweet.date_time DESC 
  LIMIT 4;
  `;
  //   console.log(getTweetsQuery);
  const tweets = await database.all(getTweetsQuery);
  response.send(tweets);
});

app.get("/user/following/", authenticateUser, async (request, response) => {
  const { username } = request;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await database.get(selectUserQuery);
  const followingUsersQuery = `
    SELECT following_user_id FROM follower 
    WHERE follower_user_id = ${dbUser.user_id};
  `;
  const followingUsersObjectsList = await database.all(followingUsersQuery);
  const followingUsersList = followingUsersObjectsList.map((object) => {
    return object["following_user_id"];
  });
  const getFollowingQuery = `
  SELECT 
    user.name AS name
  FROM 
    user
  WHERE
    user_id IN (
        ${followingUsersList}
    );
  `;
  //   console.log(getTweetsQuery);
  const following = await database.all(getFollowingQuery);
  response.send(following);
});

app.get("/user/followers/", authenticateUser, async (request, response) => {
  const { username } = request;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await database.get(selectUserQuery);
  const followerUsersQuery = `
    SELECT follower_user_id FROM follower 
    WHERE following_user_id = ${dbUser.user_id};
  `;
  const followerUsersObjectsList = await database.all(followerUsersQuery);
  const followerUsersList = followerUsersObjectsList.map((object) => {
    return object["follower_user_id"];
  });
  const getFollowersQuery = `
  SELECT 
    user.name AS name
  FROM 
    user
  WHERE
    user_id IN (
        ${followerUsersList}
    );
  `;
  const followers = await database.all(getFollowersQuery);
  response.send(followers);
});

app.get("/tweets/:tweetId/", authenticateUser, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await database.get(selectUserQuery);
  const getTweetQuery = `
  SELECT * FROM tweet WHERE tweet_id = ${tweetId};
  `;
  const tweetInfo = await database.get(getTweetQuery);

  const followingUsersQuery = `
    SELECT following_user_id FROM follower 
    WHERE follower_user_id = ${dbUser.user_id};
  `;
  const followingUsersObjectsList = await database.all(followingUsersQuery);
  const followingUsersList = followingUsersObjectsList.map((object) => {
    return object["following_user_id"];
  });
  if (!followingUsersList.includes(tweetInfo.user_id)) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const { tweet_id, date_time, tweet } = tweetInfo;
    const getlikesQuery = ` 
        SELECT COUNT(like_id) AS likes FROM like WHERE tweet_id = ${tweet_id}
        GROUP BY tweet_id;`;
    const likesObject = await database.get(getlikesQuery);
    const getReplysQuery = `
        SELECT COUNT(reply_id) AS replies FROM reply WHERE tweet_id = ${tweet_id}
        GROUP BY tweet_id;`;
    const repliesObject = await database.get(getReplysQuery);
    response.send({
      tweet,
      likes: likesObject.likes,
      replies: repliesObject.replies,
      dateTime: date_time,
    });
  }
});

app.post("/user/tweets/", authenticateUser, async (request, response) => {
  const { username } = request;
  const selectQuery = ` 
        SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await database.get(selectQuery);
  const { user_id } = dbUser;
  const { tweet } = request.body;
  const dateString = new Date().toISOString();
  const dateTime = dateString.slice(0, 10) + " " + dateString.slice(11, 19);
  const newTweet = `
    INSERT INTO tweet ( tweet, user_id, date_time)
    VALUES ( '${tweet}','${user_id}', '${dateTime}');`;
  await database.run(newTweet);
  response.send("Created a Tweet");
});

app.get(
  "/tweets/:tweetId/likes/",
  authenticateUser,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
    const dbUser = await database.get(selectUserQuery);
    const getTweetQuery = `
  SELECT * FROM tweet WHERE tweet_id = ${tweetId};
  `;
    const tweetInfo = await database.get(getTweetQuery);

    const followingUsersQuery = `
    SELECT following_user_id FROM follower 
    WHERE follower_user_id = ${dbUser.user_id};
  `;
    const followingUsersObjectsList = await database.all(followingUsersQuery);
    const followingUsersList = followingUsersObjectsList.map((object) => {
      return object["following_user_id"];
    });
    if (!followingUsersList.includes(tweetInfo.user_id)) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const { tweet_id, date_time } = tweetInfo;
      const getlikeQuery = `
            SELECT user_id FROM like WHERE tweet_id = ${tweet_id};`;
      const likedUserObjectList = await database.all(getlikeQuery);
      const likedUserIdList = likedUserObjectList.map((object) => {
        return object.user_id;
      });
      const getlikedUsersQuery = `
        SELECT username FROM user WHERE user_id in (${likedUserIdList});`;
      const linkedUserObjectList = await database.all(getlikedUsersQuery);
      const linkedUserList = linkedUserObjectList.map((object) => {
        return object.username;
      });
      response.send({
        likes: linkedUserList,
      });
    }
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  authenticateUser,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
    const dbUser = await database.get(selectUserQuery);
    const getTweetQuery = `
  SELECT * FROM tweet WHERE tweet_id = ${tweetId};
  `;
    const tweetInfo = await database.get(getTweetQuery);

    const followingUsersQuery = `
    SELECT following_user_id FROM follower 
    WHERE follower_user_id = ${dbUser.user_id};
  `;
    const followingUsersObjectsList = await database.all(followingUsersQuery);
    const followingUsersList = followingUsersObjectsList.map((object) => {
      return object["following_user_id"];
    });
    if (!followingUsersList.includes(tweetInfo.user_id)) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const { tweet_id, date_time } = tweetInfo;
      const getUserRepliesQuery = `
        SELECT user.name AS name, reply.reply AS reply
        FROM reply 
        INNER JOIN user ON reply.user_id = user.user_id 
        WHERE reply.tweet_id = ${tweet_id};
        `;
      const userRepliesObject = await database.all(getUserRepliesQuery);
      response.send({
        replies: userRepliesObject,
      });
    }
  }
);

app.get("/user/tweets/", authenticateUser, async (request, response) => {
  const { username } = request;
  const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await database.get(selectUserQuery);
  const { user_id } = dbUser;
  //   const user_id = 4;
  const getTweetsQuery = `
  SELECT * FROM tweet WHERE user_id = ${user_id}
  ORDER BY tweet_id;
  `;
  const tweetObjectsList = await database.all(getTweetsQuery);

  const tweetIdsList = tweetObjectsList.map((object) => {
    return object.tweet_id;
  });

  const getLikesQuery = `
    SELECT COUNT(like_id) AS likes FROM like 
    WHERE tweet_id IN (${tweetIdsList}) GROUP BY tweet_id
    ORDER BY tweet_id;
    `;
  const likesObjectsList = await database.all(getLikesQuery);
  const getRepliesQuery = `
    SELECT COUNT(reply_id) AS replies FROM reply 
    WHERE tweet_id IN (${tweetIdsList}) GROUP BY tweet_id
    ORDER BY tweet_id;
    `;
  const repliesObjectsList = await database.all(getRepliesQuery);
  response.send(
    tweetObjectsList.map((tweetObj, index) => {
      const likes = likesObjectsList[index] ? likesObjectsList[index].likes : 0;
      const replies = repliesObjectsList[index]
        ? repliesObjectsList[index].replies
        : 0;
      return {
        tweet: tweetObj.tweet,
        likes,
        replies,
        dateTime: tweetObj.date_time,
      };
    })
  );
});

app.delete("/tweets/:tweetId/", authenticateUser, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const getQuery = ` 
        SELECT * FROM user where username='${username}';`;
  const dbUser = await database.get(getQuery);
  const tweetQuery = `
        SELECT * FROM tweet WHERE tweet_id = ${tweetId};`;
  const tweet_info = await database.get(tweetQuery);
  if (dbUser.user_id !== tweet_info.user_id) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const deleteQuery = `
            DELETE FROM tweet WHERE tweet_id=${tweetId};`;
    await database.run(deleteQuery);
    response.send("Tweet Removed");
  }
});
module.exports = app;
