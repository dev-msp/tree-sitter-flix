def runWithIO(f: Unit -> String \ ef): String \ (ef - {Generate}) + {IO, Secret} =
    run {
        f()
    } with handler Generate {
        def system_prompt(resume) = "FedEx" |> Secret.retrieve |> resume
    }
