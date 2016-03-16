# Kaustav's Atom configurations

These are my set of configurations for the Atom text editor. It is geared for working in JavaScript, Golang, Rust, Markdown, HTML and CSS.

## Install

1. **Clone the repository**

    ```bash
    $ git clone git@github.com:kaustavdm/dotatom --recursive
    ```

2. **Set-up symlink**

    ```bash
    $ ln -s <path-to>/dotatom ~/.atom
    ```

3. **Copy config.cson.sample to config.cson and edit values**

    ```bash
    $ cp <path-to>/dotatom/config.cson.sample <path-to>/dotatom/config.cson
    ```

4. **Set-up dependencies available on npm**

    ```bash
    $ sudo npm install -g aspell jslint tern
    ```

5. **Set-up Go dependencies**

    - Install Golang
    - Set `GOPATH` environment variable
    - Install Gocode: `$ go get -u github.com/nsf/gocode`.
    - Install Golint: `$ go get -u github.com/golang/lint`.
    - Install Gorename: `$ go get golang.org/x/tools/cmd/gorename`.
    - Make sure `gocode`, `godef`, `golint` and `gorename` executibles are on `PATH`.

6. **Set-up Rust dependencies**

    - [Install Rust](https://www.rust-lang.org/install.html)
    - Download Rust sources and set `RUST_SRC_PATH` environment variable to the `./src` directory in the Rust source.
    - Install Racer: `$ cargo install racer`
    - Install Rustfmt: `$ cargo install rustfmt`
    - Make sure the `racer` and `rustfmt` executibles are on `PATH`.

7. **Install Adobe Source Code Pro font**

    - Download and install the font from [Source Code Pro releases](https://github.com/adobe-fonts/source-code-pro/releases/latest).

8. **Install atom package dependencies**:

    For Linux/OSX:

    ```bash
    $ cd <path-to>/dotatom
    $ sh ./install.sh
    ```

    For Windows:

    ```bash
    $ cd <path-to>/dotatom
    $ install.bat
    ```

    If you encounter an error, go through the error log and install necessary dependencies.

9. **Run `atom`**. In the directory that you want atom to begin, run `$ atom .`.
