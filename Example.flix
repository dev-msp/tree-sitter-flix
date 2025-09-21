eff Secret {
    def retrieve(key: String): Unit -> Option[String]
}

enum Option[t] {
    case None
    case Some(t)
}

type alias F[t] = t -> Option[t]
