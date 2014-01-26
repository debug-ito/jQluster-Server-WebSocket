use strict;
use warnings;
use Test::More;
use jQluster::Server::WebSocket;
use Twiggy::Server;
use AnyEvent;
use FindBin;

my $ENV_KEY = "JQLUSTER_SERVER_WEBSOCKET_BROWSER_TEST";

if(!$ENV{$ENV_KEY}) {
    plan skip_all => "Set $ENV_KEY to true to run browser test.";
}

my @logs = ();

my $app = jQluster::Server::WebSocket->new(
    logger => sub {
        my ($level, $message) = @_;
        my $log = "$level: $message";
        note($log);
        push(@logs, [$level, $message]);
    }
)->to_app;

my $HOST = "127.0.0.1";
my $PORT = 5555;
my $server = Twiggy::Server->new(
    host => $HOST,
    port => $PORT,
);
$server->register_service($app);

my $finish_cv = AnyEvent->condvar;
my $tw; $tw = AnyEvent->timer(after => 10, cb => sub {
    undef $tw;
    $finish_cv->send;
});

diag("Now open file://$FindBin::RealBin/js/test.html");

$finish_cv->recv;
cmp_ok scalar(@logs), ">", 0, "something is logged.";
foreach my $log (@logs) {
    ok($log->[0] !~ /err/i && $log->[0] !~ /warn/i, "log level is ok: $log->[0]");
}
done_testing;
