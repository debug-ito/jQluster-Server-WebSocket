use strict;
use warnings;
use Test::More;
use Test::Requires {
    'AnyEvent' => 0,
    'AnyEvent::WebSocket::Client' => 0.20,
    'JSON' => 0,
};
use AnyEvent;
use AnyEvent::WebSocket::Client;
use JSON qw(encode_json decode_json);
use utf8;

if(!$ENV{JQLUSTER_SERVER_WEBSOCKET_TEST_URL}) {
    plan 'skip_all',
        "If you want to test an external server, set JQLUSTER_SERVER_WEBSOCKET_TEST_URL environment variable to its WebSocket URL.";
    exit 0;
}

{
    sub send_message {
        my ($conn, $msg_obj) = @_;
        my $id = time() . "_" . rand(10000);
        my $msg = encode_json({message_id => $id, %$msg_obj});
        $conn->send($msg);
    }
}

my $timeout; $timeout = AnyEvent->timer(after => 300, cb => sub {
    fail("Time out");
    undef $timeout;
    exit 1;
});

my $conn = AnyEvent::WebSocket::Client->new->connect('ws://jqlusterserver-debugito.rhcloud.com:8000/jqluster')->recv;
ok "Connection established";

my $NODE_ID = "____NODE_ID_FOR_TEST";
my $msg_cv = AnyEvent->condvar;

$conn->on(next_message => sub {
    my ($conn, $websocket_msg) = @_;
    note "RECV --------";
    note $websocket_msg->body;
    $msg_cv->send($websocket_msg->body);
});

send_message($conn, {message_type => "register", "from" => $NODE_ID, to => undef, body => {node_id => $NODE_ID}});
my $msg = decode_json($msg_cv->recv);
is $msg->{message_type}, "register_reply", "register reply type received";
is $msg->{from}, undef, "... from server";
is $msg->{to}, $NODE_ID, "... to me";
is $msg->{body}{error}, undef, "... it's success";

done_testing;
