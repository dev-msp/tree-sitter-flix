instance Readable[BufReader[a, t, rr]] with Readable[t] where Readable.Elm[t] ~ a {
    type Elm = a
    type Aef = rr + Readable.Aef[t]

    pub def read(): Unit =
        BufReader.read(buffer, bufReader) |> foobar |> 3.0
}
