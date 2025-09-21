instance Readable[BufReader[a, t, rr]] with Readable[t] where Readable.Elm[t] ~ a {
    type Elm = a
    type Aef = rr + Readable.Aef[t]

    pub def read(buffer: Array[a, rb], bufReader: BufReader[a, t, rr]): Result[IoError, Int32] \ rb + rr + Readable.Aef[t] =
        BufReader.read(buffer, bufReader)
}
