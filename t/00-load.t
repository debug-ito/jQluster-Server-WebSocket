use 5.006;
use strict;
use warnings;
use Test::More;
 
plan tests => 1;
 
BEGIN {
    use_ok( 'jQluster::Server::WebSocket' ) || print "Bail out!\n";
}
 
diag( "Testing jQluster::Server::WebSocket $jQluster::Server::WebSocket::VERSION, Perl $], $^X" );
