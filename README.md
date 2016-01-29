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

3. **Set-up dependencies available on npm**

    ```bash
    $ sudo npm install -g jslint
    ```

4. **Set-up Go dependencies**

    - Install Golang
    - Set `GOPATH` environment variable
    - Install Gocode: `$ go get -u github.com/nsf/gocode`.
    - Install Golint: `$ go get -u github.com/golang/lint`.
    - Make sure `gocode` executible is on `PATH`.

5. **Set-up Rust dependencies**

    - [Install Rust](https://www.rust-lang.org/install.html)
    - Install Racer: `$ cargo install --git 'https://github.com/phildawes/racer.git'`
    - Make sure the `racer` executible is on `PATH`.

6. **Run `atom`**. In the directory that you want atom to begin, run `$ atom .`.
