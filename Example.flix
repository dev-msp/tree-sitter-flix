trait Provider[t] {
    type Model
    type Aef: Eff
    type Kef: Eff = Environment
    type Ef: Eff = Provider.Aef[t] + Provider.Kef[t]

    pub def apiBase(self: t): String
    pub def apiKey(self: t): Option[String] \ Provider.Kef[t]
    pub def listModels(self: t): IoResult[List[Provider.Model[t]]] \ Provider.Ef[t]
    pub def generate(self: t, params: GenerateRequest): String \ Provider.Ef[t]

    pub def handle(self: t, f: Unit -> b \ ef): b \ (ef - Generate) + Provider.Ef[t]
}
