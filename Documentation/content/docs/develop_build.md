title: Building divvy
---

Divvy is an application that should be used along with ParaView. The easiest way to get started is to use our prebuild version with a ParaView binary that can be downloaded [here](https://www.paraview.org/download/).

```
$ npm install -g pvw-divvy
$ Divvy

  Usage: Divvy [options]


  Options:

    -V, --version          output the version number
    -p, --port [8080]      Start web server with given port
    -d, --data [filePath]  Data to load
    -s, --server-only      Do not open the web browser

    --paraview [path]      Provide the ParaView root path to use

    -h, --help             output usage information
```

But if you really want to build it yourself you can run the following set of command line inside the repository

## Building Divvy

In order to build the application you can run `npm run build` for quick development usage or `npm run build:release` for production usage.

{% note warn For Windows users %}
You cannot use the previous command line for building a production ready bundle.
Instead you will need to run: `npm run build -- -p`
{% endnote %}

Either of these commands will update the `dist` directory with all the required resource.

## Building the website

Divvy comes with its tools to build the website that get published on [github.io](https://kitware.github.io/divvy/) which enables you to write documentation and see what it will look like once published.

In order to build the full website you can run the following command:

```sh
$ npm run doc:www
```

You will be able to browse the content on `http://localhost:4000/divvy`.
