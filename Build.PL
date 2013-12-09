use 5.006;
use strict;
use warnings;
use Module::Build::Pluggable (
    'CPANfile'
);
 
my $builder = Module::Build::Pluggable->new(
    module_name         => 'jQluster::Server::WebSocket',
    license             => 'perl',
    dist_author         => q{Toshio Ito <toshioito@cpan.org>},
    dist_version_from   => 'lib/jQluster/Server/WebSocket.pm',
    release_status      => 'stable',
    add_to_cleanup     => [ 'jQluster-Server-WebSocket-*' ],
    recursive_test_files => 1,
    no_index => {
        directory => ["t", "xt", "eg", "inc"],
        file => ['README.pod'],
    },
    meta_add => {
        resources => {
            bugtracker => 'https://github.com/debug-ito/jQluster-Server-WebSocket/issues',
            repository => 'git://github.com/debug-ito/jQluster-Server-WebSocket.git',
        }
    }
);
 
$builder->create_build_script();
