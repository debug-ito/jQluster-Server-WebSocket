"use strict";

var TRANSPORT = "ws://localhost:5555/";

function setupBob() {
    var bob = new jQluster.RemoteSelectorFactory({
        node_id: "bob", transport_id: TRANSPORT,
        notify: ["alice"]
    });
    return bob;
}

asyncTest("jQluster over websocket", function() {
    var bob_jqluster, $bob;
    var click_event = $.Deferred();
    $.jqluster.init("alice", TRANSPORT);
    $bob = $.jqluster("bob");
    $bob(function() {
        console.log("detected bob is ready.");
        $bob("#qunit-fixture .hoge").find("li").eq(1).text().then(function(result) {
            strictEqual(result, "2", "get li[2] ok");
            $bob("#qunit-fixture").find("ul").append("<li>4</li>");
            return $bob("#qunit-fixture").find("ul").children().size();
        }).then(function(result) {
            strictEqual(result, 4, "append new li ok");
            strictEqual($("#qunit-fixture").find("ul").children().size(), 4, "num of li is ok locally");
        }).then(function() {
            $bob("#qunit-fixture .hoge").on("click", "li", function() {
                $bob(this).text().then(function(event_source) { click_event.resolve(event_source); });
            });
            return $bob("#qunit-fixture .hoge").size(); // to ensure the on() method is handled.
        }).then(function() {
            $("#qunit-fixture .hoge li").eq(2).trigger("click");
            return click_event.promise();
        }).then(function(event_source) {
            strictEqual(event_source, "3", "locally triggerred event is caught by jQluster");
        }, function(error) {
            fail("error");
            console.error(error);
        }).always(function() {
            start();
        });
    });
    bob_jqluster = setupBob();
});



