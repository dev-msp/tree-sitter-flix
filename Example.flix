pub lawful trait Applicative[m : Type -> Type] with Functor[m] {
    law composition: forall(f: m[b -> c]) with Eq[m[c]]
      Applicative.ap(
        Applicative.point(
          (f, g) -> g >> f
        ),
        f
      ) == Applicative.ap(f, Applicative.ap(g, v))

}
