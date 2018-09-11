# Line Printer Daemon

This project implements Berkeley style line printer daemon in Javascript.

## License

MIT

## Installation

`npm install -g lp-daemon`

This will install **lp-daemon** globally. As an option you might wish to install it locally in a project as that project's dependency:

`npm install lp-daemon`

The project is exposing a function creating the server instance for its programmatic control.

## Usage

On a global installation the following command is available:

`lp-daemon --null`

This command will start lp daemon with a backend dumping incoming requests to console, only.

`lp-daemon --ipp=http://1.2.3.4:631/printers/%s`

This time lp daemon is started with a backend forwarding print jobs to an IPP service at provided URL. In that URL occurrences of `%s` are replaced with queue name as given in a print job.

### Running as a Service

This daemon is designed to run in foreground. Use software like [systemd](https://wiki.freedesktop.org/www/Software/systemd/), [forever](https://www.npmjs.com/package/forever) or [pm2](https://www.npmjs.com/package/pm2) If you like to run it in background permanently.

## Security Considerations

In Linux this software must be run as root, currently, for listening on port 515 as required. There are some countermeasures to this increased exposure to security vulnerabilities. Running the service in a docker container might limit the effects of a successful attack.
