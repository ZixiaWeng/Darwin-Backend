// Created By Zixia Weng on May 21. 2018 

// Copyright © 2018 Darwin. All rights reserved.

var mysql = require('mysql');
var express = require('express');
var escapeJSON = require('escape-json-node');
var bodyParser = require('body-parser')
var app = express();
const RecommendationEngine = require('./graph.js');
var port = 80;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

var connection = mysql.createConnection({
    host     : 'aam2629vgw55ee.czd1gxziytnq.us-east-2.rds.amazonaws.com',
    user     : 'eric',
    password : '1q2w3eDarwin',
    port     : '3306',
    database : 'darwin',
    multipleStatements: true
    });

connection.connect(function(err) {
    if (err) {
       console.error('Database connection failed: ' + err.stack);
       return;
    }
    console.log('Connected to database.');
});

// Create Graph For Darwin
var users = []
var links = []
var friends_links = []
var receng = new RecommendationEngine('darwin');

connection.query(`Select uid, fname, lname FROM user;`, function(error, rows, fields){
        if(error){
            console.log('Error in the query');
        }
        else{
            console.log('Successfull query');
            users = rows
        }
    });

connection.query(`Select uid, pid FROM user_collection;`, function(error, rows, fields){
        if(error){
            console.log('Error in the query');
        }
        else{
            console.log('Successfull query');
            links = rows
        }
    });

connection.query(`Select uid, fid FROM user_follower;`, function(error, rows, fields){
        if(error){
            console.log('Error in the query');
        }
        else{
            console.log('Successfull query');
            friends_links = rows
        }
    });

receng.load_graph('/home/ec2-user/Darwin-Backend/graph.ugd', function(err){
    if (err) {
        console.log('Error message:' + err);
    } else {
        receng.load_users(users, function(err) {
            if (err){
                console.log('Error message:' + err);
            } else {
                console.log("done");
                receng.load_collection_links(links,function(err) {
                    if (err){
                        console.log('Error message:' + err);
                    } else {
                        console.log("done");
                        receng.load_friend_links(friends_links,function(err) {
                            if (err){
                                console.log('Error message:' + err);
                            } else {
                                console.log("done");
                                // receng.recommendPodcasts()
                            }
                        });
                    }
                });
            }
        })
    }
})


// POST API ---------------------------------------------------------------------------------------------------------------------------------------

app.post("/create_user", (req, res) => {
    var fname=req.body.fname;
    var lname=req.body.lname;
    var email=req.body.email;
    var username = fname+lname;
    var imageURL = " ";
    console.log(req.body)
    connection.query(`INSERT INTO user (fname, lname, email, username, imageURL) VALUES ("${fname}", "${lname}", "${email}", "${username}", "${imageURL}")`, function(err, result){
        if(err) {return res.send(err);}
        else{
            console.log("1 user inserted");
            res.send("Success");
        }
    });
});

app.post("/create_collection", (req, res) => {
    var uid=req.body.uid;
    var pid=req.body.pid;
    console.log(req.body)
    connection.query(`INSERT INTO user_collection (uid, pid) VALUES ("${uid}", "${pid}")`, function(err, result){
        if(err) {return res.send(err);}
        else{
            console.log("1 collection inserted into Database");
            res.send("Success");
            receng.load_one_collection_link(uid, pid, function(err) {
                if (err){
                    console.log('Error message:' + err);
                } else {
                    console.log("1 collection inserted into Tree");
                }
            });
        }
    });
});

app.post("/follow_user", (req, res) => {
    var uid=req.body.uid;
    var fid=req.body.fid;
    console.log(req.body)
    connection.query(`INSERT INTO user_follower (uid, fid) VALUES ("${uid}", "${fid}")`, function(err, result){
        if(err) {return res.send(err);}
        else{
            console.log("1 follower inserted into Database");
            res.send("Success");
            receng.load_one_friend_link(uid, fid, function(err) {
                if (err){
                    console.log('Error message:' + err);
                } else {
                    console.log("1 follower inserted into Tree");
                }
            });
        }
    });
});

// DELETE API ---------------------------------------------------------------------------------------------------------------------------------------
app.delete('/delete_usr_collection/:uid/:pid',function(req,res){
     var uid = (req.params.uid)
     var pid = (req.params.pid)
     console.log(uid, pid)
     connection.query(`DELETE FROM user_collection WHERE uid = ${uid} and pid = ${pid} ;`, function(err, result){
        if(err) {console.log('Error in the query');}
        else{
            console.log("1 collection deleted");
            res.send("Success");
        }
    });
});

app.delete("/delete_user_followers/:uid/:fid", (req, res) => {
    var uid = req.params.uid;
    var fid = (req.params.fid);
    console.log(req.body)
    connection.query(`DELETE from user_follower where uid = "${uid}" and fid = ${fid} ;`, function(err, result){
        if(err) {console.log('Error in the query');}
        else{
            console.log("1 follower deleted"+uid+">"+fid);
            res.send("Success");
            receng.remove_one_friend_link(uid, fid, function(err) {
                if (err){
                    console.log('Error message:' + err);
                } else {
                    console.log("1 follower deleted from Tree");
                }
            });
        }
    });
});

// GET API ---------------------------------------------------------------------------------------------------------------------------------------

// Login With Username and Password
app.get("/login_request/:username/:password", function (req, res){
    username = req.params.username;
    password = req.params.password;
    console.log(req.body)
    connection.query(`Select uid FROM user where username = "${username}" and password = "${password}";`, function(error, rows, fields){
        if(error){
            console.log('Error in the query');
        }
        else{
            console.log('Successfull query', rows[0]["uid"]);
            res.send(rows[0]);
        }
    });
});

// Login Success With Facebook Account
app.get("/login/:email", function (req, res){
    search_key = req.params.email;
    console.log(req.body)
    connection.query(`Select uid FROM user where email = "${search_key}";`, function(error, rows, fields){
        if(error){
            console.log('Error in the query');
        }
        else{
            console.log('Successfull query');
            res.send(rows[0]);
        }
    });
});

// Get user's followers
app.get("/user_followers/:uid", (req, res) => {
    var uid=req.params.uid;
    console.log(req.body)
    connection.query(`SELECT fid from user_follower where uid = "${uid}"`, function(error, rows, fields){
        if(error){
            console.log('Error in the query');
        }
        else{
            console.log('Successfull query');
            res.send(rows);
        }
    });
});

// Load User's collection by user ID
app.get("/load_user_coll/:uid", function (req, res){
    search_key = req.params.uid;
    console.log(search_key)
    connection.query(`Select id, category, url, api_data FROM podcast_list where id in (select pid from user_collection where uid = "${search_key}");`, function(error, rows, fields){
        if(error){
            console.log('Error in the query');
        }
        else{
            console.log('Successfull query');
            var resultJsonList = [];
            for (i = 0; i < rows.length; i++) { 
                resultJson = new Object()  
                var id = rows[i]['id']
                var raw = rows[i]['api_data']
                var cat = rows[i]['category']
                var url = rows[i]['url']
                raw = raw.split("=>").join(":");
                var jsData = JSON.parse(raw)
                var parsedData = jsData['results']

                resultJson['coverArtURL'] = parsedData[0]['artworkUrl600']
                resultJson['artist'] = parsedData[0]['artistName']
                resultJson['title'] = parsedData[0]['collectionName']
                resultJson['pid'] = id
                resultJson['category'] = cat
                resultJson['url'] = url
                if(!parsedData[0]['feedUrl']){
                    resultJson['mediaURL'] = parsedData[0]['artworkUrl600']
                }
                else{
                    resultJson['mediaURL'] = parsedData[0]['feedUrl']
                }

                console.log(resultJson)

                resultJsonList.push(resultJson)
            }
            res.send(resultJsonList);
        }
    });
});

// Recommendation Algorithm by Following
app.get("/refresh_recommendation_following/:uid", function (req, res){
    uid = req.params.uid;
    result = receng.graph.closest(
      receng.graph.nodes('user').query().filter({uid__is: Number(uid)}).units()[0], // grab Sharing Economy node
      {
        compare: function(node) {
          // forget industries and uber!
          return node.entity === 'podcast';
        },
        minDepth: 2
       // only track nodes that feed in to this one
      }
    );
    // var resultJsonList = [];
    // for (var i = 0; i < result.length; i++) {
    //     resultJson = new Object()  
    //     resultJson['coverArtURL'] = result[i].end()["properties"]["artworkUrl600"]
    //     resultJson['artist'] = result[i].end()["properties"]["artistName"]
    //     resultJson['title'] = result[i].end()["properties"]["collectionName"]
    //     resultJson['pid'] = Number(result[i].end()["properties"]["id"])
    //     resultJson['category'] = result[i].end()["properties"]["category"]
    //     resultJson['url'] = result[i].end()["properties"]["url"]
    //     resultJson['mediaURL'] = result[i].end()["properties"]["feedUrl"]
    //     resultJsonList.push(resultJson)                       
    // }
    // console.log("hellohere in recommendation")
    // res.send(resultJsonList);

    var recList = []
    for (i = 0; i < result.length; i++) { 
        console.log(result[i].end()["properties"]["id"])
        recList.push(result[i].end()["properties"]["id"])
    }
    console.log(recList)

    var str = ""
    for (var i = 0; i < recList.length; i++) {
        str+=recList[i].toString();
        if (i < recList.length-1){
            str+=','
        }
    }
    console.log(str)
    connection.query(`SELECT id, category, url, api_data FROM podcast_list where id in (${str});`, function(error, rows, fields){
     if(error){
         console.log('Error in the query');
     }
     else{
        console.log('Successfull query');
        var resultJsonList = [];
        for (i = 0; i < rows.length; i++) { 
            resultJson = new Object()  
            var id = rows[i]['id']
            var cat = rows[i]['category']
            var url = rows[i]['url']
            var raw = rows[i]['api_data']
            raw = raw.split("=>").join(":");
            var jsData = JSON.parse(raw)
            var parsedData = jsData['results']

            resultJson['coverArtURL'] = parsedData[0]['artworkUrl600']
            resultJson['artist'] = parsedData[0]['artistName']
            resultJson['title'] = parsedData[0]['collectionName']
            resultJson['pid'] = id
            resultJson['category'] = cat
            resultJson['url'] = url
            if(!parsedData[0]['feedUrl']){
                resultJson['mediaURL'] = parsedData[0]['artworkUrl600']
            }
            else{
                resultJson['mediaURL'] = parsedData[0]['feedUrl']
            }
            resultJsonList.push(resultJson)                       
        }

        res.send(resultJsonList);
     }
    });
});

// Recommendation Algorithm by Content
app.get("/refresh_recommendation/:uid", function (req, res){
    uid = req.params.uid;
    connection.query(`Select category from podcast_list where id in (select pid from user_collection where uid = ${uid});`, function(error, rows, fields){
        if(error){
            console.log('Error in the query wttt');
        }
        else{
            console.log('Successfull query', rows);
            var catListForThisUser = []
            for (i = 0; i < rows.length; i++) { 
                var cat = rows[i]['category']
                if (!(catListForThisUser.includes(cat))){
                    catListForThisUser.push(cat)
                }
            } 
            console.log(catListForThisUser)
            var resultJsonList = [];
            var recList = []
            while (recList.length < 5){
                for (i = 0; i < catListForThisUser.length; i++){
                        var len = receng.graph.nodes('podcast').query().filter({category__is: catListForThisUser[i]}).units().length
                        var x = receng.graph.nodes('podcast').query().filter({category__is: catListForThisUser[i]}).units()[Math.floor(Math.random() * len) + 1 ]
                        console.log(x["properties"]["id"])
                        // resultJson = new Object() 
                        // resultJson['coverArtURL'] = x["properties"]["artworkUrl600"]
                        // resultJson['artist'] = x["properties"]["artistName"]
                        // resultJson['title'] = x["properties"]["collectionName"]
                        // resultJson['pid'] = Number(x["properties"]["id"])
                        // resultJson['category'] = x["properties"]["category"]
                        // resultJson['url'] = x["properties"]["url"]
                        // resultJson['mediaURL'] = x["properties"]["feedUrl"]
                        // resultJsonList.push(resultJson) 
                        // console.log(x)
                        recList.push(x["properties"]["id"])
                }
            }
            // console.log(resultJsonList)
            // res.send(resultJsonList);
            var str = ""
            for (var i = 0; i < recList.length; i++) {
                str+=recList[i].toString();
                if (i < recList.length-1){
                    str+=','
                }
            }
            console.log(str)
            connection.query(`SELECT id, category, url, api_data FROM podcast_list where id in (${str});`, function(error, rows, fields){
               if(error){
                   console.log('Error in the query');
               }
               else{
                    console.log('Successfull query');
                    var resultJsonList = [];
                    for (i = 0; i < rows.length; i++) { 
                        resultJson = new Object()  
                        var id = rows[i]['id']
                        var cat = rows[i]['category']
                        var raw = rows[i]['api_data']
                        var url = rows[i]['url']
                        raw = raw.split("=>").join(":");
                        var jsData = JSON.parse(raw)
                        var parsedData = jsData['results']

                        resultJson['coverArtURL'] = parsedData[0]['artworkUrl600']
                        resultJson['artist'] = parsedData[0]['artistName']
                        resultJson['title'] = parsedData[0]['collectionName']
                        resultJson['pid'] = id
                        resultJson['category'] = cat
                        resultJson['url'] = url
                        if(!parsedData[0]['feedUrl']){
                            resultJson['mediaURL'] = parsedData[0]['artworkUrl600']
                        }
                        else{
                            resultJson['mediaURL'] = parsedData[0]['feedUrl']
                        }


                        resultJsonList.push(resultJson)                       
                    }
                    
                    res.send(resultJsonList);
               }
            });
        }
    });
});


// Home Page Api
app.get('/api_home/', function (req,res) {
    connection.query("SELECT id, category, url, api_data FROM podcast_list where id in (3,30,31,34,12,14,17,18,19,20,25,26,29)", function(error, rows, fields){
       if(error){
           console.log('Error in the query');
       }
       else{
            console.log('Successfull query');
            var resultJsonList = [];
            for (i = 1; i < rows.length; i++) { 
                resultJson = new Object()  
                var id = rows[i]['id']
                var cat = rows[i]['category']
                var raw = rows[i]['api_data']
                var url = rows[i]['url']
                raw = raw.split("=>").join(":");
                var jsData = JSON.parse(raw)
                var parsedData = jsData['results']

                resultJson['coverArtURL'] = parsedData[0]['artworkUrl600']
                resultJson['artist'] = parsedData[0]['artistName']
                resultJson['title'] = parsedData[0]['collectionName']
                resultJson['pid'] = id
                resultJson['category'] = cat
                resultJson['url'] = url
                if(!parsedData[0]['feedUrl']){
                    resultJson['mediaURL'] = parsedData[0]['artworkUrl600']
                }
                else{
                    resultJson['mediaURL'] = parsedData[0]['feedUrl']
                }


                resultJsonList.push(resultJson)
            }
            
            res.send(resultJsonList);
       }
    });
});

// Get podcast by ID
app.get('/api_pod/:id', function (req,res) {
    id = req.params.id;
    connection.query(`SELECT id, category, url, api_data FROM podcast_list where id = ${id}`, function(error, rows, fields){
       if(error){
           console.log('Error in the query');
       }
       else{
            console.log('Successfull query');
            var resultJsonList = [];
            for (i = 0; i < rows.length; i++) { 
                resultJson = new Object()  
                var id = rows[i]['id']
                var raw = rows[i]['api_data']
                var cat = rows[i]['category']
                var url = rows[i]['url']
                raw = raw.split("=>").join(":");
                var jsData = JSON.parse(raw)
                var parsedData = jsData['results']

                resultJson['coverArtURL'] = parsedData[0]['artworkUrl600']
                resultJson['artist'] = parsedData[0]['artistName']
                resultJson['title'] = parsedData[0]['collectionName']
                resultJson['pid'] = id
                resultJson['category'] = cat
                resultJson['url'] = url
                if(!parsedData[0]['feedUrl']){
                    resultJson['mediaURL'] = parsedData[0]['artworkUrl600']
                }
                else{
                    resultJson['mediaURL'] = parsedData[0]['feedUrl']
                }


                resultJsonList.push(resultJson)
            }
            
            res.send(resultJsonList);
       }
    });
});

// Get Podcasts by Category
app.get('/api_pod_cat/:cat', function (req,res) {
    cat = req.params.cat;
    console.log("here")
    console.log(cat)
    connection.query(`SELECT id, category, url, api_data FROM podcast_list where category = "${cat}" limit 10`, function(error, rows, fields){
       if(error){
           console.log('Error in the query');
       }
       else{
            console.log('Successfull query');
            var resultJsonList = [];
            for (i = 0; i < rows.length; i++) { 
                resultJson = new Object()  
                var id = rows[i]['id']
                var raw = rows[i]['api_data']
                var cat = rows[i]['category']
                var url = rows[i]['url']
                raw = raw.split("=>").join(":");
                var jsData = JSON.parse(raw)
                var parsedData = jsData['results']

                resultJson['coverArtURL'] = parsedData[0]['artworkUrl600']
                resultJson['artist'] = parsedData[0]['artistName']
                resultJson['title'] = parsedData[0]['collectionName']
                resultJson['pid'] = id
                resultJson['category'] = cat
                resultJson['url'] = url
                if(!parsedData[0]['feedUrl']){
                    resultJson['mediaURL'] = parsedData[0]['artworkUrl600']
                }
                else{
                    resultJson['mediaURL'] = parsedData[0]['feedUrl']
                }


                resultJsonList.push(resultJson)
            }
            
            res.send(resultJsonList);
       }
    });
});

app.get('/api_coll_user_count/:pid', function (req,res) {
    pid = req.params.pid;
    console.log("here")
    connection.query(`SELECT COUNT(uid) as 'count' FROM user_collection where pid = ${pid}`, function(error, rows, fields){
       if(error){
           console.log('Error in the query');
       }
       else{
            console.log('Successfull query');
            console.log(rows)
            res.send(rows);
       }
    });
});

app.get('/api_coll_user/:pid', function (req,res) {
    pid = req.params.pid;
    console.log("here")
    connection.query(`SELECT fname, lname, uid, username, imageURL from user where uid in (SELECT uid FROM user_collection where pid = ${pid})`, function(error, rows, fields){
       if(error){
           console.log('Error in the query');
       }
       else{
            console.log('Successfull query');
            console.log(rows)
            res.send(rows);
       }
    });
});

app.get('/api_coll_user/:pid', function (req,res) {
    pid = req.params.pid;
    console.log("here")
    connection.query(`SELECT fname, lname, uid, username, imageURL from user where uid in (SELECT uid FROM user_collection where pid = ${pid})`, function(error, rows, fields){
       if(error){
           console.log('Error in the query');
       }
       else{
            console.log('Successfull query');
            console.log(rows)
            res.send(rows);
       }
    });
});

// Home Page Api Raw Data
app.get('/load_user_following/:uid', function (req,res) {
    uid = req.params.uid;
    connection.query(`SELECT fname, lname, uid, username, imageURL from user where uid in (SELECT uid FROM user_follower where fid = ${uid})`, function(error, rows, fields){
       if(error){
           console.log('Error in the query');
       }
       else{
            console.log('Successfull query');
            console.log(rows)
            res.send(rows);
       }
    });
});

// Search Episode with Podcast Id
app.get('/api_episode/:pid/', function (req,res) {
    search_key = req.params.pid;
    connection.query(`SELECT podcast_id as pid, podcast, episode as title, release_date, info FROM episode where podcast_id = "${search_key}";`, function(error, rows, fields){
        if(error){
            console.log('Error in the query');
        }
        else{
            console.log('Successfull query');
            var resultJsonList = [];
            for (i = 0; i < rows.length; i++) { 
                rows[i]['eid'] = 0
                rows[i]['artist'] = " "
                rows[i]['mediaURL'] = "http://"
            }
            
            res.send(rows);
        }
    });
});

// Get Episode Data With Podcast Name
app.get('/api_pc_epsd/:podcast_name/', function (req,res) {
    search_key = req.params.podcast_name;
    connection.query(`SELECT episode FROM episode where podcast = "${search_key}" limit 5;`, function(error, rows, fields){
       if(error){
           console.log('Error in the query');
       }
       else{
           console.log('Successfull query');
           console.log(rows);
           res.send(rows);
       }
    });
});

// Search Podcast
app.get('/api_search/:a?/', function (req,res) {
    search_key = req.params.a;

    var sql = `SELECT id, category, url, api_data FROM podcast_list where podcast LIKE '%${search_key}%' `
    console.log(sql)
    connection.query(sql, search_key, function(error, rows, fields){
       if(error){
           console.log('Error in the query');
       }
       else{
           console.log('Successfull query with search_key:', search_key);
           var resultJsonList = [];
            for (i = 1; i < rows.length; i++) { 
                resultJson = new Object()  // init the new json object for return 
                var id = rows[i]['id']
                var raw = rows[i]['api_data']
                var cat = rows[i]['category']
                var url = rows[i]['url']
                // console.log(raw+"-------------\r\n");
                raw = raw.split("=>").join(":");
                raw = raw.replace(/(\r\n\t|\n|\r\t)/gm,"");
                // console.log(raw+"-------------\r\n");

                try {
                    var jsData = JSON.parse(raw);
                } catch(e) {
                    console.log('malformed request', raw);
                    console.log(e);
                    // return res.status(400).send('malformed request: ' + raw);
                }
                var parsedData = jsData['results']
                resultJson['pid'] = id
                resultJson['category'] = cat
                resultJson['url'] = url
                resultJson['coverArtURL'] = parsedData[0]['artworkUrl600']
                resultJson['artist'] = parsedData[0]['artistName']
                resultJson['title'] = parsedData[0]['collectionName']
                resultJson['duration'] = 0
                resultJson['mediaURL'] = parsedData[0]['feedUrl']
                resultJsonList.push(resultJson)
            }
            res.send(resultJsonList);
       }
    });
});

//home page: TRENDING
app.get('/api_trending/', function (req,res) {
    connection.query("SELECT podcast_list.api_data, episode.podcast_id as pid, episode.podcast, episode.episode as title, episode.release_date, episode.info, episode.id as eid FROM episode join podcast_list ON episode.podcast_id = 131 and episode.podcast_id = podcast_list.id limit 4;", function(error, rows, fields){
       if(error){
           console.log('Error in the query');
       }
       else{
            console.log('Successfull query');
            // res.send(rows);
            var resultJsonList = [];
            for (i = 0; i < rows.length; i++) { 
                // resultJson = new Object()  // init the new json object for return 
                var raw = rows[i]['api_data']
                // console.log(raw+"-------------\r\n");
                raw = raw.split("=>").join(":");
                raw = raw.replace(/(\r\n\t|\n|\r\t)/gm,"");
                // console.log(raw+"-------------\r\n");

                try {
                    var jsData = JSON.parse(raw);
                } catch(e) {
                    console.log('malformed request', raw);
                    console.log(e);
                    // return res.status(400).send('malformed request: ' + raw);
                }
                var parsedData = jsData['results']
                rows[i]['artist'] = parsedData[0]['artistName']
                rows[i]['coverArtURL'] = parsedData[0]['artworkUrl600']
                rows[i]['mediaURL'] = parsedData[0]['feedUrl']

                delete rows[i]['api_data']
                // resultJsonList.push(resultJson)
            }
            res.send(rows);
            // showRes(res, rows);
       }
    });
});

// Handle 404 - Keep this as a last route
app.use(function(req, res, next) {
    res.status(404);
    res.send('404: File Not Found');
});

// Listen to port other than 80
app.listen(port, () => console.log('Example app listening on port 5000!'));

// End Connection
app.on('close', function() {
    connection.end();
});
