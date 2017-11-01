title: Requirements
---

Installing and developing divvy is quite easy, there are just two dependencies:

- [Node.js](http://nodejs.org/)
- [Git](http://git-scm.com/) - only necessary for developing and committing to the library.

Instructions for installing these are located at the bottom of this page. If your computer already has these, congratulations!

To install divvy within your project:

```sh
$ npm install pvw-divvy --save
```

If you're developing for pvw-divvy, then clone the repository using git:

```sh
$ git clone https://github.com/kitware/divvy.git
$ cd divvy
$ npm install
```

Further instructions on divvy development can be found on the [contributing page](https://kitware.github.io/divvy/docs/misc_contributing.html).

### Git

- Windows: Download & install [git](https://git-scm.com/download/win).
- Mac: Install it with [Homebrew](http://mxcl.github.com/homebrew/), [MacPorts](http://www.macports.org/) or [installer](http://sourceforge.net/projects/git-osx-installer/).
- Linux (Ubuntu, Debian): `sudo apt-get install git-core`
- Linux (Fedora, Red Hat, CentOS): `sudo yum install git-core`

{% note warn For Mac users %}
You may encounter some problems when compiling. Please install Xcode from App Store first. After Xcode is installed, open Xcode and go to **Preferences -> Download -> Command Line Tools -> Install** to install command line tools.
{% endnote %}

### Node.js

The best way to install Node.js is with [nvm](https://github.com/creationix/nvm).
