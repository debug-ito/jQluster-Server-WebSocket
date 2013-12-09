use strict;
use warnings;
use Test::More;
use jQluster::Server::WebSocket;
use Test::Requires {
    "Twiggy::Server" => "0",
    "AnyEvent::WebSocket::Client" => "0.20",
    "Net::EmptyPort" => "0",
};
use Twiggy::Server;
use AnyEvent;
use AnyEvent::WebSocket::Client;
use Net::EmptyPort qw(empty_port);
use JSON qw(encode_json decode_json);

sub set_timeout {
    my ($timeout) = @_;
    $timeout ||= 30;
    my $w; $w = AnyEvent->timer(after => $timeout, cb => sub {
        undef $w;
        fail("Timeout");
        exit 1;
    });
}

sub create_server {
    my @logs = ();
    my $port = empty_port();
    my $server = Twiggy::Server->new(
        host => "127.0.0.1",
        port => $port,
    );
    my $app = jQluster::Server::WebSocket->new(
        logger => sub {
            push(@logs, \@_);
        }
    );
    $server->register_service($app->to_app);
    return ($port, $server, \@logs);
}

{
    my $next_id = 0;
    sub set_id {
        my ($msg) = @_;
        $msg->{message_id} = $next_id;
        $next_id++;
        return $msg;
    }
}

sub send_msg {
    my ($conn, $msg) = @_;
    $conn->send(encode_json($msg));
}

sub receive_msg_cv {
    my ($conn) = @_;
    my $cv_recv = AnyEvent->condvar;
    $conn->on(next_message => sub {
        my ($conn, $msg) = @_;
        $cv_recv->send($msg->body);
    });
    return $cv_recv;
}

sub create_connection {
    my ($port, $remote_node_id) = @_;
    my $conn = AnyEvent::WebSocket::Client->connect("ws://127.0.0.1:$port/")->recv;
    my $registration = set_id({
        from => $remote_node_id, message_type => "register",
        body => { remote_id => $remote_node_id }
    });
    my $cv_reply = receive_msg_cv($conn);
    send_msg($conn, $registration);
    my $reply_str = $cv_reply->recv;
    my $reply = decode_json($reply_str);
    delete $reply->{message_id};
    is_deeply $reply, {
        message_type => "register_reply",
        from => undef, to => $remote_node_id,
        body => { error => undef,
                  in_reply_to => $registration->{message_id} },
    }, "remote_node_id $remote_node_id: register_reply message OK";
    return $conn;
}


set_timeout;

{
    my ($port, $server, $logs) = create_server();
    my $alice = create_connection($port, "alice");
    my $bob = create_connection($port, "bob");

    {
        my $cv_bob_recv = receive_msg_cv($bob);
        my $msg = set_id {
            from => "alice", to => "bob", message_type => "hoge"
        };
        $alice->send(encode_json($msg));
        my $got_msg = decode_json($cv_bob_recv->recv);
        is_deeply $got_msg, $msg, "message delivered alice -> bob";
    }

    my $alice2 = create_connection($port, "alice");

    {
        my @cv_alices = map { receive_msg_cv($_) } ($alice, $alice2);
        my $msg = set_id {
            from => "bob", to => "alice", message_type => "foobar"
        };
        $bob->send(encode_json($msg));
        my @got_msgs = map { decode_json($_->recv) } @cv_alices;
        is_deeply \@got_msgs, [$msg, $msg],
            "IDs with the same remote node ID should receive the same message";
    }
    
}

done_testing;
