package jQluster::Server::WebSocket;
use strict;
use warnings;

our $VERSION = "0.01";

1;
__END__

=pod

=head1 NAME

jQluster::Server::WebSocket - jQluster server implementation using WebSocket transport

=head1 SYNOPSIS

In your app.psgi

    use Plack::Builder;
    use jQluster::Server::WebSocket;
    
    my $jq_server = jQluster::Server::WebSocket->new();
    
    builder {
        mount "/jqluster", $jq_server->to_app;
        mount "/", $your_app;
    };

Then, in your JavaScript code

    $.jqluster.init("my_node_id", "ws://myhost.mydomain/jqluster");


=head1 DESCRIPTION

L<jQluster::Server::WebSocket> is a jQluster server implementation
using simple WebSocket transport. It accepts WebSocket connections and
distribute jQluster messages through the connections.

L<jQluster::Server::WebSocket> creates a L<PSGI> application. You can
use it as a stand-alone app or mount it together with your own app.

Currently L<jQluster::Server::WebSocket> uses
L<Plack::App::WebSocket>, so your L<PSGI> server must meet its
requirements.

=head1 CLASS METHODS

=head2 $server = jQluster::Server::WebSocket->new()

The constructor.

=head1 OBJECT METHODS

=head2 $psgi_app = $server->to_app()

Create a L<PSGI> application object from the C<$server>.


=head1 SEE ALSO

=over

=item L<jQluster::Server>

jQluster server independent of connection implementations.

=item L<Plack::App::WebSocket>

WebSocket server implementation as a L<Plack> app.

=back


=head1 REPOSITORY

L<https://github.com/debug-ito/jQluster-Server-WebSocket>

=head1 BUGS AND FEATURE REQUESTS

Please report bugs and feature requests to my Github issues
L<https://github.com/debug-ito/jQluster-Server-WebSocket/issues>.

Although I prefer Github, non-Github users can use CPAN RT
L<https://rt.cpan.org/Public/Dist/Display.html?Name=jQluster-Server-WebSocket>.
Please send email to C<bug-jQluster-Server-WebSocket at rt.cpan.org> to report bugs
if you do not have CPAN RT account.


=head1 AUTHOR
 
Toshio Ito, C<< <toshioito at cpan.org> >>


=head1 LICENSE AND COPYRIGHT

Copyright 2013 Toshio Ito.

This program is free software; you can redistribute it and/or modify it
under the terms of either: the GNU General Public License as published
by the Free Software Foundation; or the Artistic License.

See L<http://dev.perl.org/licenses/> for more information.


=cut

